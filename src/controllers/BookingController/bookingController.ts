import { Booking, BookingStatus, Employee, WarrantyStatus } from '@prisma/client';
import { NextFunction, Response } from "express";
import Request from "../../shared/interfaces/Request";
import { BaseKey } from "../../shared/constants/BaseKeyConstants";
import BookingModel from "../../models/BookingModel";
import { BookingCreateValidationSchema, BookingListingParamsValidationSchema, BookingUpdateValidationSchema, WarrantyActionValidationSchema, WarrantyRequestValidationSchema } from "./bookingController.validation";
import { ErrorModel } from "../../models/ErrorModel";
import { RoleEnum } from '../../shared/enum/role-enum';
import { BookingStatusEnum } from '../../shared/enum/booking-status-enum';
import { prisma } from '../../..';
import { generateExcel, uploadToS3 } from '../../plugins/export';
import notifyUser from '../../shared/utils/notifyUser';
import UserCustomerModel from '../../models/UserCustomerModel';

export default class BookingController {

    async index(request: Request, response: Response, next: NextFunction) {

        try {
            const params = await BookingListingParamsValidationSchema.validate(request.query, { stripUnknown: true })

            const { bookings, meta } = await new BookingModel().index(params);

            if (params.export && request.user?.id && request.user.role.name === RoleEnum.ADMIN) {
                const excelBuffer = await generateExcel("booking", bookings);
                const url = await uploadToS3(excelBuffer, "booking");
                return response
                    .status(200)
                    .json({
                        url
                    })
            }

            response.status(200).json({ bookings, meta });
        } catch (error) {
            next(error);
        }
    }

    async customerIndex(request: Request, response: Response, next: NextFunction) {

        try {

            const customerId = request.user?.id

            const params = await BookingListingParamsValidationSchema.validate(request.query, { stripUnknown: true })

            const bookings = await new BookingModel().index(params, customerId);

            response.status(200).json(bookings);
        } catch (error) {
            next(error);
        }
    }

    async create(request: Request, response: Response, next: NextFunction) {
        try {

            const getQuotation = (request.query["quotation"])

            const userId = request.user?.id
            if (!request.body[BaseKey.BOOKING].customerId && userId && request.body[BaseKey.BOOKING])
                request.body[BaseKey.BOOKING].customerId = userId
            const addressId = request.address?.id
            if (addressId && request.body[BaseKey.BOOKING])
                request.body[BaseKey.BOOKING].addressId = addressId

            const body = await BookingCreateValidationSchema.validate(
                request.body[BaseKey.BOOKING],
                { stripUnknown: true, abortEarly: false }
            );

            const booking = await new BookingModel().create(body, getQuotation === "true") as Booking
            if (booking?.id && request.user?.id) {
                await new BookingModel().createLog(booking.id, request.user?.id, "created")

                notifyUser({ toMobile: (booking as any).customer?.mobile, toAddress: (booking as any).customer?.mail || undefined }, "booking_update", {
                    booking: booking as Booking,
                })
            }
            response.status(200).json({ booking });
        } catch (error) {
            next(error);
        }
    }

    async show(request: Request, response: Response, next: NextFunction) {
        try {

            const bookingId = Number(Number(request.params["bookingId"]))

            if (!bookingId || isNaN(bookingId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Booking id missing!",
                    name: "Invalid request"
                })

            let customerId;
            if (request.user?.role.name === RoleEnum.CUSTOMER)
                customerId = request.user?.id

            if (!request.user?.id)
                throw new ErrorModel({
                    statusCode: 401,
                    message: "User id missing!",
                    name: "Invalid authentication"
                })

            const booking = await new BookingModel().show(bookingId, customerId);
            // notifyUser({ toMobile: request.user.mobile, toAddress: request.user.mail || undefined }, "booking_update", {
            //     booking: booking as Booking,
            //     employee: (booking?.status === "warranty_request_accepted" ? booking.warrantyEmployee : booking?.employee) as Employee,
            // })
            response.status(200).json({ booking });
        } catch (error) {
            next(error);
        }
    }

    async update(request: Request, response: Response, next: NextFunction) {
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

            const body = await BookingUpdateValidationSchema.validate(
                request.body[BaseKey.BOOKING],
                { stripUnknown: true, abortEarly: false }
            );

            const bookingModel = new BookingModel()
            let status = body.status

            if (status === BookingStatus.rejected) {
                const booking = await bookingModel.show(bookingId)
                if (booking?.isOnlinePayment) {
                    await bookingModel.statusUpdate(bookingId, status, request.user?.id);
                    status = BookingStatus.refund_pending
                }
            }

            const [booking] = await Promise.all([
                bookingModel.statusUpdate(bookingId, status, request.user?.id),
                bookingModel.update(bookingId, { isOnlinePayment: body.isOnlinePayment })
            ])
            booking.customer?.mobile && notifyUser({ toMobile: booking.customer?.mobile, toAddress: booking.customer?.mail || undefined }, "booking_update", {
                booking: booking as Booking,
                employee: (booking?.status === "warranty_request_accepted" ? booking.warrantyEmployee : booking?.employee) as Employee,
            })
            response.status(200).json({ booking });
        } catch (error) {
            console.log(error)
            next(error);
        }
    }

    async updateAddress(request: Request, response: Response, next: NextFunction) {
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

            const address = await new UserCustomerModel().getPrimaryAddress(request.user.id)

            if (!address?.id)
                throw new ErrorModel({
                    statusCode: 404,
                    message: "Primary address not found!",
                    name: "Invalid request"
                })

            const booking = await new BookingModel().updateAddress(bookingId, address.id)

            if (!booking || !booking?.id)
                throw new ErrorModel({
                    code: 422,
                    message: "Unable to change booking address",
                    name: "Unallocatable address"
                })

            response.status(200).json({ booking });
        } catch (error) {
            console.log(error)
            next(error);
        }
    }

    async assignEmployee(request: Request, response: Response, next: NextFunction) {
        try {

            const bookingId = Number(request.params["bookingId"])
            const employeeId = Number(request.params["employeeId"])

            let name = ""
            if (!bookingId || isNaN(bookingId))
                name = "Booking id missing!"
            if (!employeeId || isNaN(employeeId))
                name = "Employee id missing!"

            if (name)
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Invalid request",
                    name
                })

            const bookingModel = new BookingModel()

            const booking = await bookingModel.assignEmployee(bookingId, employeeId);

            const employee = booking.status === BookingStatus.warranty_request_accepted
                ? booking.warrantyEmployee
                : booking.employee

            if (booking?.id && request.user?.id && employee)
                await Promise.all([
                    bookingModel.createLog(booking.id, request.user?.id, "assigned", {
                        employee
                    }),
                    booking.status !== BookingStatus.warranty_request_accepted
                    && bookingModel.createLog(booking.id, request.user?.id, "status_changed", { status: BookingStatus.approved })
                ])
            notifyUser({ toMobile: booking.customer.mobile, toAddress: booking.customer.mail || undefined }, "booking_update", {
                booking: booking as Booking,
                employee: (booking?.status === "warranty_request_accepted" ? booking.warrantyEmployee : booking?.employee) as Employee,
            })
            response.status(200).json({ booking });
        } catch (error) {
            console.log(error)
            next(error);
        }
    }

    async getActivityLogs(request: Request, response: Response, next: NextFunction) {
        try {
            const bookingId = Number(request.params["bookingId"])

            if (!bookingId || isNaN(bookingId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Invalid request",
                    name: "Booking id missing!"
                })

            const bookingLogs = await new BookingModel().fetchLogs(bookingId);

            response.status(200).json({ bookingLogs });
        } catch (error) {
            next(error);
        }
    }

    async delete(request: Request, response: Response, next: NextFunction) {
        try {

            const bookingId = Number(request.params["bookingId"])

            if (!bookingId || isNaN(bookingId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Booking id missing!",
                    name: "Invalid request"
                })

            const booking = await new BookingModel().delete(bookingId);

            response.status(200).json({ booking });
        } catch (error) {
            next(error);
        }
    }

    async customerDelete(request: Request, response: Response, next: NextFunction) {
        try {

            const bookingId = Number(request.params["bookingId"])
            const userId = request.user?.id

            if (!bookingId || isNaN(bookingId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Booking id missing!",
                    name: "Invalid request"
                })

            if (!userId)
                throw new ErrorModel({
                    statusCode: 422,
                    message: "User id missing!",
                    name: "Invalid request"
                })


            const booking = await new BookingModel().customerDelete(bookingId, userId);

            response.status(200).json({ booking });
        } catch (error) {
            next(error);
        }
    }

    async applyCoupon(request: Request, response: Response, next: NextFunction) {
        try {
            const bookingId = Number(request.params["bookingId"])
            const couponId = Number(request.params["couponId"])

            let message;
            if (!bookingId || isNaN(bookingId))
                message = "Booking id missing!";

            if (!couponId || isNaN(couponId))
                message = "Coupon id missing!";

            if (message)
                throw new ErrorModel({
                    statusCode: 422,
                    message,
                    name: "Invalid request"
                })

            const booking = await new BookingModel().applyCoupon(bookingId, couponId)

            response.status(200).json({ booking });

        } catch (error) {
            next(error)
        }
    }

    async cancel(request: Request, response: Response, next: NextFunction) {
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

            const bookingModel = new BookingModel()
            let status: BookingStatus = BookingStatus.cancelled

            const currentBooking = await bookingModel.show(bookingId)
            if (currentBooking?.isOnlinePayment && request.user?.id) {
                const booking = await bookingModel.statusUpdate(bookingId, status, request.user.id);
                currentBooking.customer?.mobile && notifyUser({ toMobile: currentBooking.customer?.mobile, toAddress: currentBooking.customer?.mail || undefined }, "booking_update", {
                    booking: booking as Booking,
                })
                status = BookingStatus.refund_pending
            }

            const booking = await bookingModel.statusUpdate(bookingId, status, request.user.id);
            response.status(200).json({ booking });
        } catch (error) {
            next(error)
        }
    }

    async warrantyRequest(request: Request, response: Response, next: NextFunction) {
        try {

            const bookingId = Number(request.params["bookingId"])

            if (!bookingId || isNaN(bookingId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Booking id missing!",
                    name: "Invalid request"
                })
            const body = await WarrantyRequestValidationSchema.validate(
                request.body[BaseKey.WARRANTY],
                { stripUnknown: true, abortEarly: false }
            );

            const booking = await new BookingModel().raiseWarrantyRequest(bookingId, body);
            if (booking?.id && request.user?.id) {
                await new BookingModel().createLog(booking.id, request.user?.id, "warranty_requested")

                booking.customer?.mobile && notifyUser({ toMobile: booking.customer?.mobile, toAddress: booking.customer?.mail || undefined }, "booking_update", {
                    booking: booking as Booking,
                    employee: (booking?.status === "warranty_request_accepted" ? booking.warrantyEmployee : booking?.employee) as Employee,
                })
            }
            response.status(200).json({ booking });
        } catch (error) {
            console.log(error)
            next(error)
        }
    }

    async changeWarrantyRequestStatus(request: Request, response: Response, next: NextFunction) {
        try {
            const bookingId = Number(request.params["bookingId"])
            const warrantyId = Number(request.params["warrantyId"])

            let message;
            if (!bookingId || isNaN(bookingId))
                message = "Booking id missing!";

            if (!warrantyId || isNaN(warrantyId))
                message = "Warranty id missing!";

            if (message)
                throw new ErrorModel({
                    statusCode: 422,
                    message,
                    name: "Invalid request"
                })

            const body = await WarrantyActionValidationSchema.validate(
                request.body[BaseKey.WARRANTY],
                { stripUnknown: true, abortEarly: false }
            );

            const [booking, warranty] = await new BookingModel().updateWarrantyRequest(bookingId, warrantyId, body.status);

            if (booking?.id && request.user?.id) {
                await new BookingModel().createLog(booking.id, request.user?.id, "status_changed", {
                    status: body.status === WarrantyStatus.approved
                        ? BookingStatus.warranty_request_accepted
                        : BookingStatus.warranty_request_rejected
                })
                body.status === WarrantyStatus.rejected && notifyUser({ toMobile: booking.customer.mobile, toAddress: booking.customer.mail || undefined }, "booking_update", {
                    booking: booking as Booking,
                    employee: (booking?.status === "warranty_request_accepted" ? booking.warrantyEmployee : booking?.employee) as Employee,
                })
            }
            response.status(200).json({ warranty });
        } catch (error) {
            next(error)
        }
    }
}