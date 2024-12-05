import { date } from 'serializr';
import { NextFunction, Response } from "express";
import Request from "../../shared/interfaces/Request";
import axios from 'axios';
import { ErrorModel } from "../../models/ErrorModel";
import { prisma } from "../../..";
import { Booking, BookingStatus, Employee, PaymentTypes, Prisma } from "@prisma/client";
import { toTitleCase } from "../../shared/utils/toTitleCase";
import { PaymentListingParamsValidationSchema, RefundCreateValidationSchema } from "./PaymentController.validation";
import { BaseKey } from "../../shared/constants/BaseKeyConstants";
import { v4 as uuidv4 } from 'uuid';
import BookingModel from "../../models/BookingModel";
import { PAGE_LIMIT } from "../../shared/constants/paginationMeta";
import { GlobalSearchParams } from "../../models/UserModel";
import { SortEnum } from "../../shared/enum/sort-enum";
import sha256 from 'sha256'
import { generateExcel, uploadToS3 } from "../../plugins/export";
import notifyUser from "../../shared/utils/notifyUser";
import logger from "../../shared/utils/logger";
import routeConstants from "../../shared/constants/RouteConstants";
type FilterKeys = {
    type?: PaymentTypes
    customerId?: number
}

type OrderKeys = "createdAt" | "amount" | "transactionStatus" | "type"

export type PhonePePaymentCode = "PAYMENT_SUCCESS" | "PAYMENT_ERROR" | "INTERNAL_SERVER_ERROR" | "PAYMENT_PENDING"

interface SearchParams extends GlobalSearchParams {
    orderBy?: Record<OrderKeys, SortEnum>
    filterBy?: FilterKeys
}

export const getHeaders = (): any => {
    let headers = {
        'Content-Type': 'application/json',
    };
    return headers;
};

const axiosInstance = axios.create();

axiosInstance.interceptors.request.use(function (config) {
    logger.info(`[PAYMENT GATEWAY] [${config.method}] [${config.url}]`, { ...config })
    config.headers = getHeaders();
    return config;
});

const PaymentController = () => {

    const initiatePayment = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const PAYMENT_GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL,
                PAYMENT_GATEWAY_RETURN_URL = process.env.PAYMENT_GATEWAY_RETURN_URL,
                PAYMENT_GATEWAY_CALLBACK_URL = process.env.PAYMENT_GATEWAY_CALLBACK_URL

            if (!PAYMENT_GATEWAY_URL || !PAYMENT_GATEWAY_RETURN_URL || !PAYMENT_GATEWAY_CALLBACK_URL)
                throw new ErrorModel({
                    code: 500,
                    name: "Payment Gateway Url initialization failed",
                    message: "Environment config invalid"
                })

            const bookingId = Number(request.params["bookingId"])

            if (!bookingId || isNaN(bookingId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Booking id missing!",
                    name: "Invalid request"
                })

            const booking = await prisma.booking.update({
                data: { isOnlinePayment: true, status: BookingStatus.payment_pending },
                where: { id: bookingId },
                include: { customer: true }
            })

            const merchantId = process.env.PAYMENT_MERCHANT_ID
            const index = process.env.PAYMENT_SALT_INDEX
            const key = process.env.PAYMENT_SALT_KEY

            const data = {
                "merchantId": merchantId,
                "merchantTransactionId": bookingId,
                "merchantUserId": String(booking?.customerId),
                "amount": booking.total * 100,
                "redirectUrl": PAYMENT_GATEWAY_RETURN_URL + "/post-booking/" + bookingId,
                "redirectMode": "REDIRECT",
                "callbackUrl": PAYMENT_GATEWAY_CALLBACK_URL + routeConstants.API_V1 + "/shared" + routeConstants.PAYMENT_SUCCESS_HOOK,
                "mobileNumber": booking?.customer.mobile,
                "paymentInstrument": {
                    "type": "PAY_PAGE"
                }
            }

            const buffer = Buffer.from(JSON.stringify(data), "utf-8")
            const encodedData = buffer.toString("base64")
            const xVerify = sha256(encodedData + "/pg/v1/pay" + key) + "###" + index

            const options = {
                method: 'post',
                url: PAYMENT_GATEWAY_URL + "/pg/v1/pay",
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-VERIFY': xVerify
                },
                data: { request: encodedData }
            }

            const res = await axios.request(options)

            response
                .status(201)
                .json(res.data["data"]["instrumentResponse"]["redirectInfo"]["url"])

        } catch (error) {
            // console.log(error)
            next()
        }

    }

    const retryPayment = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const PAYMENT_GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL

            if (!PAYMENT_GATEWAY_URL)
                throw new ErrorModel({
                    code: 500,
                    name: "Payment Gateway Url initialization failed",
                    message: "Environment config invalid"
                })

            const bookingId = Number(request.params["bookingId"])

            if (!bookingId || isNaN(bookingId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Booking id missing!",
                    name: "Invalid request"
                })

            if (!bookingId || isNaN(bookingId)) throw new Error("Order Id required!")

            const merchantId = process.env.PAYMENT_MERCHANT_ID
            const index = process.env.PAYMENT_SALT_INDEX
            const key = process.env.PAYMENT_SALT_KEY
            const xVerify = sha256(`/pg/v1/status/${merchantId}/${bookingId}` + key) + "###" + index

            const options = {
                method: 'get',
                url: `${PAYMENT_GATEWAY_URL}/pg/v1/status/${merchantId}/${bookingId}`,
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-VERIFY': xVerify,
                    "X-MERCHANT-ID": merchantId
                },
            }

            const res = await axios.request(options)

            response.json(res.data)
        } catch (error: any) {
            response.json(error).status(error?.response?.status)
        }
    }

    const refund = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const body = await RefundCreateValidationSchema.validate(request.body[BaseKey.PAYMENT], { stripUnknown: true, abortEarly: false })

            const PAYMENT_GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL,
                PAYMENT_GATEWAY_CALLBACK_URL = process.env.PAYMENT_GATEWAY_CALLBACK_URL

            if (!PAYMENT_GATEWAY_URL || !PAYMENT_GATEWAY_CALLBACK_URL)
                throw new ErrorModel({
                    code: 500,
                    name: "Payment Gateway Url initialization failed",
                    message: "Environment config invalid"
                })

            const bookingId = Number(request.params["bookingId"])

            if (!bookingId || isNaN(bookingId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Booking id missing!",
                    name: "Invalid request"
                })

            const transaction = await prisma.transaction.findFirst({
                where: {
                    bookingId,
                    type: PaymentTypes.credited
                }
            })

            if (!transaction)
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Original transaction missing!",
                    name: "Invalid request"
                })

            let refundTransactionId = uuidv4()
            while (await prisma.transaction.findUnique({ where: { transactionId: refundTransactionId } })) {
                refundTransactionId = uuidv4()
            }

            const merchantId = process.env.PAYMENT_MERCHANT_ID
            const index = process.env.PAYMENT_SALT_INDEX
            const key = process.env.PAYMENT_SALT_KEY

            const data = {
                "merchantId": merchantId,
                "merchantTransactionId": refundTransactionId,
                "originalTransactionId": bookingId,
                "amount": 100,
                "callbackUrl": PAYMENT_GATEWAY_CALLBACK_URL + routeConstants.API_V1 + "/shared" + routeConstants.REFUNDS_HOOK,
            }
            logger.info(JSON.stringify(data))
            const buffer = Buffer.from(JSON.stringify(data), "utf-8")
            const encodedData = buffer.toString("base64")
            const xVerify = sha256(encodedData + "/pg/v1/refund" + key) + "###" + index

            const options = {
                method: 'post',
                url: PAYMENT_GATEWAY_URL + "/pg/v1/refund",
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-VERIFY': xVerify
                },
                data: { request: encodedData }
            }
            const res = await axios.request(options)

            if (res.data["code"] == "TRANSACTION_NOT_FOUND" || res.data["code"] == "INTERNAL_SERVER_ERROR")
                throw res.data

            logger.info(JSON.stringify(res.data))
            // 267c1518-fb24-4300-b19c-819c42ad0255
            const payment = await prisma.transaction.create({
                data: {
                    bookingId,
                    id: refundTransactionId,
                    amount: body.amount,
                    type: PaymentTypes.refunded,
                    transactionId: res.data["data"]["transactionId"],
                    transactionStatus: toTitleCase(res.data["data"]["state"])
                }
            })

            response
                .status(200)
                .json({ payment, res: res.data })
        } catch (error) {
            // Cleanup
            // await prisma.transaction.deleteMany({ where: { transactionStatus: "refund_pending" } })
            const refundError = (error as any)
            next(refundError.response.data || refundError)
            // next(new ErrorModel({
            //     name: refundError?.response?.code || "Invalid refund request",
            //     message: toTitleCase(refundError?.response?.data?.message) || "Unable to process refund"
            // }))
        }
    }

    const paymentStatus = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const PAYMENT_GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL

            if (!PAYMENT_GATEWAY_URL)
                throw new ErrorModel({
                    code: 500,
                    name: "Payment Gateway Url initialization failed",
                    message: "Environment config invalid"
                })

            const bookingId = Number(request.params["bookingId"])

            if (!bookingId || isNaN(bookingId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Booking id missing!",
                    name: "Invalid request"
                })

            if (!request.user?.id)
                throw new ErrorModel({
                    statusCode: 401,
                    message: "User id missing!",
                    name: "Invalid authentication"
                })
            const bookingModel = new BookingModel()

            const currentBooking = await prisma.booking.findUnique({ where: { id: bookingId }, include: bookingModel.includes })

            if (currentBooking?.isOnlinePayment && currentBooking?.status === BookingStatus.payment_completed) {
                const booking = await bookingModel.statusUpdate(bookingId, BookingStatus.booked, request.user?.id)
                currentBooking.customer?.mobile && notifyUser({ toMobile: currentBooking.customer?.mobile, toAddress: currentBooking.customer?.mail || undefined }, "booking_update", {
                    booking: booking as Booking,
                    employee: booking?.employee as Employee,
                })
                response.json({ booking })
                return;
            }

            if (!currentBooking?.isOnlinePayment || currentBooking?.status !== BookingStatus.payment_pending) {
                response.json({ booking: currentBooking })
                return;
            }

            const merchantId = process.env.PAYMENT_MERCHANT_ID
            const index = process.env.PAYMENT_SALT_INDEX
            const key = process.env.PAYMENT_SALT_KEY
            const xVerify = sha256(`/pg/v1/status/${merchantId}/${bookingId}` + key) + "###" + index

            const options = {
                method: 'get',
                url: `${PAYMENT_GATEWAY_URL}/pg/v1/status/${merchantId}/${bookingId}`,
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-VERIFY': xVerify,
                    "X-MERCHANT-ID": merchantId
                },
            }

            const res = await axios.request(options)
            const code = res.data["code"] as PhonePePaymentCode

            let status: BookingStatus = BookingStatus.payment_failed

            if (code === "PAYMENT_SUCCESS") {
                const booking = await bookingModel.statusUpdate(bookingId, BookingStatus.payment_completed, request.user?.id)
                status = BookingStatus.booked
                booking.customer?.mobile && notifyUser({ toMobile: booking.customer?.mobile, toAddress: booking.customer?.mail || undefined }, "booking_update", {
                    booking: booking as Booking,
                    employee: booking?.employee as Employee,
                })
            }

            const booking = await bookingModel.statusUpdate(bookingId, status, request.user?.id)

            if (booking && !await prisma.transaction.findFirst({ where: { bookingId, type: PaymentTypes.credited } }))
                await prisma.transaction.create({
                    data: {
                        bookingId,
                        amount: booking.total,
                        type: PaymentTypes.credited,
                        transactionStatus: toTitleCase(res.data["data"]["state"]),
                        transactionId: String(res.data["data"]["transactionId"]),
                    }
                })
            booking.customer?.mobile && notifyUser({ toMobile: booking.customer?.mobile, toAddress: booking.customer?.mail || undefined }, "booking_update", {
                booking: booking as Booking,
                employee: (booking?.status === "warranty_request_accepted" ? booking.warrantyEmployee : booking?.employee) as Employee,
            })

            response.json({ booking })
        } catch (error: any) {
            response.json(error).status(error?.response?.status)
        }
    }

    const index = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const where: Prisma.TransactionWhereInput = {}

            const bookingId = Number(request.params["bookingId"])
            if (bookingId) {
                Object.assign(where, { bookingId })

                //     if (request.user?.id)
                //         await new BookingModel().fetchRefundStatus(bookingId, request.user.id)
            }

            const params = await PaymentListingParamsValidationSchema.validate(request.query, { stripUnknown: true })

            if (params?.filterBy?.search)
                Object.assign(where, {
                    OR: [
                        { booking: { customer: { name: { contains: params.filterBy?.search, mode: 'insensitive' } } } },
                        (!isNaN(+(params.filterBy?.search || 0)) ? { booking: { uid: { equals: +(params.filterBy?.search || 0) } } } : {})
                    ]
                });

            const take = params?.limit || PAGE_LIMIT;
            const skip = ((params?.page || 1) - 1) * take;

            if (params?.filterBy?.type)
                Object.assign(where, {
                    OR: [
                        { type: { equals: params?.filterBy?.type } }
                    ],
                });

            if (params?.filterBy?.customerId)
                Object.assign(where, {
                    OR: [
                        { booking: { customer: { id: params?.filterBy?.customerId } } }
                    ],
                });

            const orderBy: any = params.orderBy

            const payments = await prisma.transaction.findMany({
                ...(!params?.export ? { take, skip } : {}),
                where,
                include: {
                    booking: {
                        select: {
                            id: true,
                            uid: true,
                            customer: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                },
                orderBy: Object.keys(orderBy).length ? orderBy : { createdAt: "desc" },
            })

            if (params.export) {
                const excelBuffer = await generateExcel("transaction", payments);
                const url = await uploadToS3(excelBuffer, "transaction");
                return response
                    .status(200)
                    .json({
                        url
                    })
            }
            const totalCount = await prisma.transaction.count({ where })

            const meta: SearchParams = {
                filterBy: params.filterBy,
                orderBy,
                limit: params.limit || PAGE_LIMIT,
                page: params.page || 1,
                totalCount,

            }
            response
                .status(200)
                .json({ payments, meta })
        } catch (error) {
            next((error as any))
        }
    }

    const verifyPhonePeSignature = (req: Request, res: Response, next: any) => {
        const phonepeSignature = req.headers['x-verify'] as string;
        const bodyString = (req.body["response"]);
        const index = process.env.PAYMENT_SALT_INDEX
        const key = process.env.PAYMENT_SALT_KEY
        const xVerify = sha256(bodyString + key) + "###" + index
        if (phonepeSignature === xVerify) {
            next();
            return;
        } else {
            logger.error(`[${req.requestId}] In Phonepe callback, callback verification failed`)
            return res.status(403).send('Invalid Signature');
        }
    };

    const paymentCallback = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const callbackData = JSON.parse(atob(request.body["response"]));
            const code = callbackData["code"] as PhonePePaymentCode
            logger.error(JSON.stringify(callbackData["data"]))
            const bookingId = Number(callbackData["data"]["merchantTransactionId"])

            const bookingModel = new BookingModel()
            const booking = await bookingModel.show(bookingId)

            if (!booking || !booking.customer || !booking.customer.mobile) {
                logger.error(`[${request.requestId}] In Phonepe callback, Booking id invalid`)
                return response.status(403).send('Invalid booking id');
            }

            let status: BookingStatus = BookingStatus.payment_failed

            if (code === "PAYMENT_SUCCESS") {
                await bookingModel.statusUpdate(bookingId, BookingStatus.payment_completed, booking.customerId)
                status = BookingStatus.booked
                notifyUser({ toMobile: booking?.customer?.mobile, toAddress: booking?.customer?.mail || undefined }, "booking_update", {
                    booking: ({ ...booking, status: BookingStatus.payment_completed }) as Booking,
                    employee: booking?.employee as Employee,
                })
            }

            await bookingModel.statusUpdate(bookingId, status, booking.customerId)

            if (!await prisma.transaction.findFirst({ where: { bookingId, type: PaymentTypes.credited } }))
                await prisma.transaction.create({
                    data: {
                        bookingId,
                        amount: booking.total,
                        type: PaymentTypes.credited,
                        transactionStatus: toTitleCase(callbackData["data"]["state"]),
                        transactionId: String(callbackData["data"]["transactionId"]),
                    }
                })
            notifyUser({ toMobile: booking?.customer.mobile, toAddress: booking?.customer.mail || undefined }, "booking_update", {
                booking: ({ ...booking, status }) as Booking,
                employee: (booking?.status === "warranty_request_accepted" ? booking.warrantyEmployee : booking?.employee) as Employee,
            })

            return response.status(200).send({
                success: true,
            });
        } catch (error) {
            console.log(error)
            next(error)
        }
    }

    const refundCallback = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const callbackData = JSON.parse(atob(request.body["response"]));
            const code = callbackData["code"] as PhonePePaymentCode
            const transactionId = callbackData["data"]["merchantTransactionId"]

            const transaction = await prisma.transaction.update({
                where: { id: transactionId },
                data: { transactionStatus: toTitleCase(callbackData["data"]["state"]), }
            })

            if (!transaction || !transaction.bookingId) {
                logger.error(`[${request.requestId}] In Phonepe callback, Transaction id invalid`)
                return response.status(403).send('Invalid transaction id');
            }

            const bookingId = transaction?.bookingId
            const bookingModel = new BookingModel()
            const booking = await bookingModel.show(bookingId)

            if (!booking || !booking.customer || !booking.customer.mobile) {
                logger.error(`[${request.requestId}] In Phonepe callback, Booking id invalid`)
                return response.status(403).send('Invalid booking id');
            }

            let status: BookingStatus = BookingStatus.refund_failed

            if (code === "PAYMENT_SUCCESS")
                status = BookingStatus.refund_completed
            else if (code === "PAYMENT_PENDING") {
                logger.info(`[${request.requestId}] In Phonepe callback, Transaction(#${transactionId}) is still pending`)
                return response.status(200).send({
                    success: true,
                });
            }

            await bookingModel.statusUpdate(bookingId, status, booking.customerId)

            notifyUser({ toMobile: booking?.customer.mobile, toAddress: booking?.customer.mail || undefined }, "booking_update", {
                booking: ({ ...booking, status }) as Booking,
                employee: (booking?.status === "warranty_request_accepted" ? booking.warrantyEmployee : booking?.employee) as Employee,
            })
            logger.info(`[${request.requestId}] In Phonepe callback, Booking(#${bookingId}) updated to ${status}`)
            logger.info(`[${request.requestId}] In Phonepe callback, Transaction(#${transactionId}) updated to status ${toTitleCase(callbackData["data"]["state"])}`)

            return response.status(200).send({
                success: true,
            });
        } catch (error) {
            next(error)
        }
    }

    const refundStatus = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const bookingId = Number(request.params["bookingId"])

            if (!bookingId || isNaN(bookingId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Booking id missing!",
                    name: "Invalid request"
                })

            if (!request.user?.id)
                throw new ErrorModel({
                    statusCode: 401,
                    message: "User id missing!",
                    name: "Invalid authentication"
                })

            const booking = await new BookingModel().fetchRefundStatus(bookingId, request.user.id)
            if (booking?.customer?.mobile)
                await notifyUser({ toMobile: booking?.customer?.mobile, toAddress: booking?.customer?.mail || undefined }, "booking_update", {
                    booking: booking as Booking,
                    employee: booking?.employee as Employee,
                })
            response.json({ booking })
        } catch (error) {
            next(error)
        }
    }

    return {
        index,
        refund,
        refundStatus,
        retryPayment,
        paymentStatus,
        initiatePayment,
        verifyPhonePeSignature,
        paymentCallback,
        refundCallback,
    }
}

export default PaymentController
