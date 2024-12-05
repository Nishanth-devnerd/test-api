import { NextFunction, Response } from "express";
import Request from "../../shared/interfaces/Request";
import { BaseKey } from "../../shared/constants/BaseKeyConstants";
import { ErrorModel } from "../../models/ErrorModel";
import { EnquiryUpdateValidationSchema, EnquiryValidationSchema } from "./enquiryController.validation";
import { prisma } from "../../..";
import notifyUser from "../../shared/utils/notifyUser";
import { generateOTP } from "../../shared/utils/generateOTP";

const EnquiryController = () => {

    const index = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const enquiries = await prisma.enquiry.findMany({
                orderBy: {
                    createdAt: "asc"
                }
            })

            response
                .status(200)
                .json({ enquiries })
        } catch (error) {
            next(error)
        }
    }

    const sendOTP = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const body = await EnquiryValidationSchema.validate(request.body[BaseKey.ENQUIRY], { stripUnknown: true })

            const otp = generateOTP(4)

            await notifyUser({ toMobile: body.mobile }, "enquiry_otp", { otp })

            response
                .status(200)
                .json({ otp })
        } catch (error) {
            next(error)
        }
    }
    const create = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const body = await EnquiryValidationSchema.validate(request.body[BaseKey.ENQUIRY], { stripUnknown: true })

            const enquiry = await prisma.enquiry.create({ data: body })

            response
                .status(201)
                .json({ enquiry })
        } catch (error) {
            next(error)
        }
    }

    const updateStatus = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const enquiryId = Number(request.params["enquiryId"])

            if (!enquiryId || isNaN(enquiryId)) throw new ErrorModel({ statusCode: 422, message: "Location id missing!", name: "Invalid request" })

            const body = await EnquiryUpdateValidationSchema.validate(request.body[BaseKey.ENQUIRY], { stripUnknown: true })

            const enquiry = await prisma.enquiry.update({
                where: { id: enquiryId },
                data: body
            })

            response
                .status(200)
                .json({ enquiry })
        } catch (error) {
            next(error)
        }
    }


    return {
        index,
        create,
        sendOTP,
        updateStatus,
    }
}

export default EnquiryController