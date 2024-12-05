import { NextFunction, Response } from "express";
import UserCustomerModel from "../../models/UserCustomerModel";
import Request from "../../shared/interfaces/Request";
import { CustomerAddressCreateValidationSchema, CustomerAddressUpdateValidationSchema, CustomerUpdateValidationSchema } from "./UserCustomerController.validation";
import { BaseKey } from "../../shared/constants/BaseKeyConstants";
import { ErrorModel } from "../../models/ErrorModel";
import { prisma } from "../../..";
import { deserialize } from "serializr";
import { AuthSerializer } from "../../serializers/AuthSerializer";

class UserCustomerController {

    async show(request: Request, response: Response, next: NextFunction) {
        try {
            const userId = Number(request.params["userId"] ?? request.user?.id);

            if (!userId || isNaN(userId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Address id missing!",
                    name: "Invalid request",
                });

            const onlinePaymentWhereClause = { booking: { customerId: userId, isOnlinePayment: true, } }

            const [customer, onlineCredited, onlineRefunded, offlineCredited] = await Promise.all([
                new UserCustomerModel().show(userId),
                prisma.transaction.aggregate({
                    where: { ...onlinePaymentWhereClause, type: "credited" },
                    _sum: { amount: true }
                }),
                prisma.transaction.aggregate({
                    where: { ...onlinePaymentWhereClause, type: "refunded" },
                    _sum: { amount: true }
                }),
                prisma.booking.aggregate({
                    where: {
                        customerId: userId,
                        isOnlinePayment: false
                    },
                    _sum: { total: true }
                })
            ])

            const accountSummary = {
                credited: (onlineCredited._sum.amount || 0) + (offlineCredited._sum.total || 0),
                refunded: onlineRefunded._sum.amount || 0
            }
            response
                .status(200)
                .json({ customer, accountSummary })
        } catch (error) {
            console.log(error)
            next(500)
        }
    }

    async update(request: Request, response: Response, next: NextFunction) {
        try {
            const userId = Number(request.params["userId"] ?? request.user?.id);

            if (!userId || isNaN(userId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Address id missing!",
                    name: "Invalid request",
                });

            const body = await CustomerUpdateValidationSchema.validate(
                request.body[BaseKey.CUSTOMER],
                { stripUnknown: true, abortEarly: false }
            );

            const customer = await new UserCustomerModel().update(userId, body)

            response
                .status(200)
                .json({ customer })
        } catch (error) {
            next(error)
        }
    }

    async listAddress(request: Request, response: Response, next: NextFunction) {
        try {
            const customerId = Number(request.params["userId"] ?? request.user?.id);

            if (!customerId)
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Customer id missing!",
                    name: "Invalid request",
                });

            const addresses = await new UserCustomerModel().listAddresses(customerId);

            response.status(200).json({ addresses });
        } catch (error) {
            next(error);
        }
    }

    async createAddress(request: Request, response: Response, next: NextFunction) {
        try {

            const body = await CustomerAddressCreateValidationSchema.validate(
                request.body[BaseKey.ADDRESS],
                { stripUnknown: true, abortEarly: false }
            );

            //Will pick customer id from body => admin request
            //Will pick customer id from request => customer request
            const customerId = Number(body.userId || request.params["userId"] || request.user?.id);

            if (!customerId || isNaN(customerId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Customer id missing!",
                    name: "Invalid request",
                });

            const address = await new UserCustomerModel().addAddress(customerId, body);

            response.status(200).json({ address });
        } catch (error) {
            next(error);
        }
    }

    async updateAddress(request: Request, response: Response, next: NextFunction) {
        try {
            const addressId = Number(request.params["addressId"]);

            if (!addressId || isNaN(addressId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Address id missing!",
                    name: "Invalid request",
                });

            const body = await CustomerAddressUpdateValidationSchema.validate(
                request.body[BaseKey.ADDRESS],
                { stripUnknown: true, abortEarly: false }
            );

            const address = await new UserCustomerModel().updateAddress(addressId, body);

            response.status(200).json({ address });
        } catch (error) {
            next(error);
        }
    }

    async removeAddress(request: Request, response: Response, next: NextFunction) {
        try {
            const addressId = Number(request.params["addressId"]);

            if (!addressId || isNaN(addressId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Address id missing!",
                    name: "Invalid request",
                });

            await new UserCustomerModel().deleteAddress(addressId);

            response.status(200).json({});
        } catch (error) {
            next(error);
        }
    }
}

export default UserCustomerController;
