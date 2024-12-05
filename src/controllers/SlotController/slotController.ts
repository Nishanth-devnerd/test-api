import { NextFunction, Response } from "express";
import Request from "../../shared/interfaces/Request";
import { ErrorModel } from "../../models/ErrorModel";
import { BaseKey } from "../../shared/constants/BaseKeyConstants";
import { SlotCreateValidationSchema, SlotUpdateValidationSchema } from "./slotController.validation";
import SlotModel from "../../models/SlotModel";


class SlotController {

    async index(request: Request, response: Response, next: NextFunction) {
        try {
            const serviceId = Number(request.params["serviceId"]);

            if (!serviceId || isNaN(serviceId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Service id missing!",
                    name: "Invalid request",
                });

            const slots = await new SlotModel().index(serviceId);

            response.status(200).json({ slots });
        } catch (error) {
            next(error);
        }
    }

    async create(request: Request, response: Response, next: NextFunction) {
        try {
            const serviceId = Number(request.params["serviceId"]);

            if (!serviceId || isNaN(serviceId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Service id missing!",
                    name: "Invalid request",
                });

            const body = await SlotCreateValidationSchema.validate(
                request.body[BaseKey.SLOT],
                { stripUnknown: true, abortEarly: false }
            );

            const slots = await new SlotModel().create(serviceId, body);

            response.status(200).json({ slots });
        } catch (error) {
            next(error);
        }
    }

    async update(request: Request, response: Response, next: NextFunction) {
        try {
            const serviceId = Number(request.params["serviceId"]);

            if (!serviceId || isNaN(serviceId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Service id missing!",
                    name: "Invalid request",
                });

            const body = await SlotUpdateValidationSchema.validate(
                request.body[BaseKey.SLOT],
                { stripUnknown: true, abortEarly: false }
            );

            const slots = await new SlotModel().changeStatus(serviceId, body, body.active);

            response.status(200).json({ slots });
        } catch (error) {
            next(error);
        }
    }

}

export default SlotController