import { NextFunction, Response } from "express";
import Request from "../../shared/interfaces/Request";
import FaqModel from "../../models/FaqModel";
import { BaseKey } from "../../shared/constants/BaseKeyConstants";
import { ErrorModel } from "../../models/ErrorModel";
import { FaqCreateValidationSchema, FaqUpdateValidationSchema } from "./FaqController.validation";

const FaqController = () => {

    const index = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const serviceId = Number(request.params["serviceId"])

            if (!serviceId || isNaN(serviceId)) throw new ErrorModel({ statusCode: 422, message: "Service id missing!", name: "Invalid request" })

            const faqs = await new FaqModel().index(serviceId)

            response
                .status(200)
                .json({ faqs })
        } catch (error) {
            next(error)
        }
    }

    const create = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const body = await FaqCreateValidationSchema.validate(request.body[BaseKey.FAQ], { stripUnknown: true, abortEarly: false })

            const faq = await new FaqModel().create(body)
            response
                .status(200)
                .json({ faq })

        } catch (error) {
            next(error)
        }
    }

    const updateMany = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const serviceId = Number(request.params["serviceId"])

            if (!serviceId || isNaN(serviceId)) throw new ErrorModel({ statusCode: 422, message: "Service id missing!", name: "Invalid request" })

            const body = await FaqUpdateValidationSchema.validate(request.body[BaseKey.FAQS], { stripUnknown: true, abortEarly: false })
            if (!body?.length) throw new ErrorModel({ statusCode: 422, message: "Empty body can't be updated", name: " Invalid request data" })

            const faqs = await new FaqModel().updateMany(serviceId, body)
            response
                .status(200)
                .json({ faqs })

        } catch (error) {
            next(error)
        }
    }

    const remove = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const faqId = Number(request.params["faqId"])

            if (!faqId || isNaN(faqId)) throw new ErrorModel({ statusCode: 422, message: "Faq id missing!", name: "Invalid request" })

            await new FaqModel().delete(faqId)
            response
                .status(200)
                .json({})

        } catch (error) {
            next(error)
        }
    }


    return {
        index,
        create,
        updateMany,
        remove,
    }
}

export default FaqController