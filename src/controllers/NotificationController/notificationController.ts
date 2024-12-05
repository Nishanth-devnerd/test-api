import { NotificationListingParamsValidationSchema, NotificationValidationSchema } from './notificationController.validation';
import { removeFalsyKeys } from './../../shared/utils/removeFalsyKeys';
import { NextFunction, Response } from "express"
import { deserialize, serialize } from "serializr"
import { prisma } from "../../.."
import { UserFilterSerializer, UserSerializer } from "../../serializers/UserSerializer"
import Request from "../../shared/interfaces/Request"
import { BookingStatus } from '@prisma/client';
import { AdminRegisterationValidationSchema, RegisterationValidationSchema } from '../AuthController/AuthController.validation';
import { BaseKey } from '../../shared/constants/BaseKeyConstants';
import { AuthSerializer } from '../../serializers/AuthSerializer';
import { NotificationFilterSerializer, NotificationSerializer } from '../../serializers/NotificationSerializer';
import NotificationModel from '../../models/NotificationModel';
import { ErrorModel } from '../../models/ErrorModel';

const NotificationController = () => {

    const index = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const params = await NotificationListingParamsValidationSchema.validate(request.query, { stripUnknown: true })

            const orderBy = serialize(NotificationSerializer, params?.orderBy as any)

            const filterBy = serialize(NotificationFilterSerializer, params.filterBy)

            const serializedSortKeys = removeFalsyKeys(orderBy)

            const serializedFilterKeys = removeFalsyKeys(filterBy)

            if (serializedSortKeys)
                params.orderBy = serializedSortKeys
            else
                delete params?.orderBy

            if (serializedFilterKeys)
                params.filterBy = serializedFilterKeys as any

            const { notifications, meta } = await new NotificationModel().index(params as any)


            response
                .status(200)
                .json({ notifications, meta })
        } catch (error) {
            next(error)
        }
    }

    const show = async (request: Request, response: Response, next: NextFunction) => {

        const notificationId = request.params["notificationId"]

        if (!notificationId) throw new ErrorModel({ statusCode: 422, message: "Notification id missing!", name: "Invalid request" })

        const notification = await new NotificationModel().show(Number(notificationId))

        response
            .status(200)
            .json({ notification })
    }

    const create = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const body = await NotificationValidationSchema.validate(request.body[BaseKey.NOTIFICATION], { stripUnknown: true })

            const notification = await new NotificationModel().create(body)

            response
                .status(201)
                .json({ notification })
        } catch (error) {
            next(error)
        }
    }

    return {
        index,
        show,
        create,
    }
}

export default NotificationController