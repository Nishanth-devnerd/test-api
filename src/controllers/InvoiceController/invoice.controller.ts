import { ErrorModel } from "../../models/ErrorModel"
import { NextFunction, Response } from "express"
import Request from "../../shared/interfaces/Request"
import { InvoiceCreateValidationSchema, InvoiceListingParamsValidationSchema, InvoiceUpdateValidationSchema } from "./invoice.controller.validation"
import { BaseKey } from "../../shared/constants/BaseKeyConstants"
import { prisma } from "../../.."
import moment from "moment"
import { date, deserialize, serialize } from "serializr"
import BookingModel from "../../models/BookingModel"
import { BookingStatus, Prisma } from "@prisma/client"
import { generateInvoicePdf } from "../../shared/utils/generateInvoicePdf"
import { InvoiceListItems } from "../../serializers/InvoiceSerializer"
import { PAGE_LIMIT } from "../../shared/constants/paginationMeta"
import { dateToTimestampString } from "../../shared/utils/dateToTimestampString"
import { generateExcel, uploadToS3 } from "../../plugins/export"
import { mergeAndUploadPdfs } from "../../shared/utils/mergeAndUploadPdfs"
import sendMail from "../../plugins/email"

const InvoiceController = () => {

    const index = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const params = await InvoiceListingParamsValidationSchema.validate(request.query, { stripUnknown: true })
            const where: Prisma.InvoiceWhereInput = {}
            const orderBy: any = params.orderBy

            if (params?.filterBy?.search)
                Object.assign(where, {
                    OR: [
                        { refNumber: { contains: params.filterBy?.search, mode: 'insensitive' } },
                    ]
                });

            if (params?.filterBy && params.filterBy?.invoiceRange) {
                const startDate = dateToTimestampString(params.filterBy?.invoiceRange[0]);
                const endDate = dateToTimestampString(params.filterBy?.invoiceRange[1]);
                endDate.setDate(endDate.getDate() + 1)
                Object.assign(where, {
                    date: {
                        gte: startDate,
                        lte: endDate,
                    },
                });
            }
            const take = params?.limit || PAGE_LIMIT;
            const skip = ((params?.page || 1) - 1) * take;
            console.log(params.filterBy)
            const invoices = await prisma.invoice.findMany({
                select: {
                    refNumber: true,
                    bookingId: true,
                    booking: { select: { total: true, customer: { select: { name: true } } } },
                    customer: { select: { name: true } },
                    date: true,
                    pdfUrl: true,
                },
                ...(!params?.export ? { take, skip } : {}),
                where,
                orderBy: Object.keys(orderBy).length ? orderBy : { createdAt: "desc" },
            })

            if (params.export) {
                const url = await mergeAndUploadPdfs(invoices
                    .map(invoice => invoice.pdfUrl)
                    .filter(url => !!url) as string[])

                return response
                    .status(200)
                    .json({
                        url
                    })
            }
            response
                .status(200)
                .json({ invoices: deserialize(InvoiceListItems, invoices) })
        } catch (error) {
            next(error)
        }
    }

    const create = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const body = await InvoiceCreateValidationSchema.validate(request.body[BaseKey.INVOICE], { stripUnknown: true, abortEarly: false })

            const booking = await new BookingModel().show(body.bookingId)

            if (!booking?.customerId)
                throw new ErrorModel({ statusCode: 422, message: "Invalid booking", name: "Invalid booking" })


            let [invoice] = await Promise.all([
                prisma.invoice.create({
                    data: {
                        refNumber: body.refNumber,
                        bookingId: body.bookingId,
                        billingAttention: body.billingAttention,
                        billingAddress: body.billingAddress,
                        billingCity: body.billingCity,
                        billingState: body.billingState,
                        billingZip: body.billingZip,
                        billingCountry: body.billingCountry,
                        billingPhone: body.billingPhone,
                        shippingAttention: body.shippingAttention,
                        shippingAddress: body.shippingAddress,
                        shippingCity: body.shippingCity,
                        shippingState: body.shippingState,
                        shippingZip: body.shippingZip,
                        shippingCountry: body.shippingCountry,
                        shippingPhone: body.shippingPhone,
                        date: body.date,
                        customerId: booking.customerId
                    },
                    include: { booking: { include: { service: true, employee: true, bookingTaxes: true } } }
                }),
                request.user?.id && booking.status === BookingStatus.completed &&
                new BookingModel().statusUpdate(body.bookingId, BookingStatus.invoiced, request.user?.id)
            ])

            const pdfUrl = await generateInvoicePdf(invoice).catch(console.error);

            if (pdfUrl)
                invoice = await prisma.invoice.update({
                    where: { id: invoice.id },
                    data: { pdfUrl },
                    include: { booking: { include: { service: true, employee: true, bookingTaxes: true } } }
                })
            response
                .status(201)
                .json({ invoice })

        } catch (error) {
            next(error)
        }
    }

    const update = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const invoiceId = Number(request.params["invoiceId"])

            if (isNaN(invoiceId) || !invoiceId) throw new ErrorModel({ statusCode: 422, message: "Invoice id missing!", name: "Invalid request" })

            const body = await InvoiceUpdateValidationSchema.validate(request.body[BaseKey.INVOICE], { stripUnknown: true, abortEarly: false })

            let invoice = await prisma.invoice.update({
                where: { id: invoiceId },
                data: body,
                include: { booking: { include: { service: true, employee: true, customer: true, task: true, slot: true, address: { include: { geolocation: true } }, warrantyEmployee: true, bookingTaxes: { include: { tax: true } } } } }
            })
            console.log(invoice.booking)
            const pdfUrl = await generateInvoicePdf(invoice).catch(console.error);
            // const pdfUrl = await sendM/ail("nishanth", "ooking", invoice.booking, invoice.refNumber).catch(console.error);


            if (pdfUrl)
                invoice = await prisma.invoice.update({
                    where: { id: invoiceId },
                    data: { pdfUrl },
                    include: { booking: { include: { service: true, employee: true, customer: true, task: true, slot: true, address: { include: { geolocation: true } }, warrantyEmployee: true, bookingTaxes: { include: { tax: true } } } } }
                })

            response
                .status(200)
                .json({ invoice })

        } catch (error) {
            console.log(error)
            next(error)
        }
    }


    return {
        index,
        create,
        update,
    }
}

export default InvoiceController