import { BookingStatus } from '@prisma/client';
import { NextFunction, Response } from "express";
import { deserialize, serialize } from "serializr";
import { prisma } from "../../..";
import UserModel from "../../models/UserModel";
import { generateExcel, uploadToS3 } from '../../plugins/export';
import { AuthSerializer } from '../../serializers/AuthSerializer';
import { UserFilterSerializer, UserSerializer } from "../../serializers/UserSerializer";
import { BaseKey } from '../../shared/constants/BaseKeyConstants';
import Request from "../../shared/interfaces/Request";
import { AdminRegisterationValidationSchema } from '../AuthController/AuthController.validation';
import { removeFalsyKeys } from './../../shared/utils/removeFalsyKeys';
import { UserListingParamsValidationSchema } from "./UserController.validation";

const UserController = () => {

    const index = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const params = await UserListingParamsValidationSchema.validate(request.query, { stripUnknown: true })

            const orderBy = serialize(UserSerializer, { ...params?.orderBy } as unknown)

            const filterBy = serialize(UserFilterSerializer, { ...params?.filterBy } as unknown)

            const serializedSortKeys = removeFalsyKeys(orderBy) as UserSerializer

            const serializedFilterKeys = removeFalsyKeys(filterBy) as UserFilterSerializer

            if (serializedSortKeys)
                params.orderBy = serializedSortKeys
            else
                delete params?.orderBy

            if (serializedFilterKeys)
                params.filterBy = serializedFilterKeys
            else
                delete params?.filterBy

            const { users, meta } = await new UserModel(prisma.user).index(params as any)

            if (params.export) {
                const excelBuffer = await generateExcel("customer", users);
                const url = await uploadToS3(excelBuffer, "customer");
                return response
                    .status(200)
                    .json({
                        url
                    })
            }
            const serializedMeta = { ...meta }
            if (meta.orderBy)
                serializedMeta.orderBy = deserialize(UserSerializer, meta.orderBy) as any
            if (meta.filterBy)
                serializedMeta.filterBy = deserialize(UserFilterSerializer, meta.filterBy) as any

            response
                .status(200)
                .json({ users: deserialize(UserSerializer, users), meta: serializedMeta })
        } catch (error) {
            next(error)
        }
    }

    const show = async (request: Request, response: Response, next: NextFunction) => {
        try {
            if (request.user?.id) {
                const bookings = await prisma.booking.findMany({
                    where: {
                        customerId: request.user.id,
                        status: BookingStatus.initiated
                    },
                    include: {
                        service: {
                            include: {
                                baseOffer: true,
                                attachments: true
                            }
                        },
                        bookingTaxes: true,
                        slot: true,
                        task: true,
                        appliedOffer: true,
                        appliedCoupon: {
                            include: {
                                offer: true
                            }
                        },
                        address: {
                            include: {
                                geolocation: true
                            }
                        }
                    }
                })
                const booking = bookings?.at(-1)
                if (!booking?.taskId)
                    return response
                        .status(200)
                        .json({
                            user: deserialize(UserSerializer, request.user)
                        })

                if (bookings.length > 1)
                    await prisma.booking.updateMany({
                        where: {
                            id: {
                                not: bookings.at(-1)?.id
                            },
                            customerId: request.user.id,
                            status: BookingStatus.initiated
                        },
                        data: {
                            status: BookingStatus.deleted_by_user
                        }
                    })
                let locationCost = 0
                let location;
                if (booking?.mappedLocationId) {
                    location = await prisma.taskLocation.findUnique({
                        where: {
                            taskId_locationId: {
                                taskId: booking?.taskId,
                                locationId: booking?.mappedLocationId
                            }
                        },
                        include: { offer: true }
                    })
                    locationCost = location?.cost || 0
                } else {
                    locationCost = booking.task.baseCost
                }

                const inspectionBooking = booking.service?.inspectionTaskId === booking.taskId
                const taskCost = location && !booking.service.isAvailableEverywhere
                    ? location.cost
                    : booking.task.baseCost

                return response
                    .status(200)
                    .json({
                        user: deserialize(UserSerializer, request.user),
                        booking: {
                            ...booking,
                            // ...(booking?.task && {
                            //     task: {
                            //         ...booking?.task,
                            //         baseCost: locationCost
                            //     }
                            // })
                            ...(!inspectionBooking && booking?.task && {
                                task: {
                                    ...booking?.task,
                                    baseCost: (booking.service.isAvailableEverywhere ? taskCost : location?.cost) || 0
                                }
                            })
                        }
                    })
            }

            response
                .status(200)
                .json({ user: deserialize(UserSerializer, request.user) })
        } catch (error) {
            next(error)
        }
    }

    const create = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const body = await AdminRegisterationValidationSchema.validate(request.body[BaseKey.AUTH], { stripUnknown: true })
            const user = new UserModel(prisma.user)
            const result = await user.adminSignup(body)

            response
                .status(201)
                .json({ user: deserialize(AuthSerializer, result) })
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

export default UserController