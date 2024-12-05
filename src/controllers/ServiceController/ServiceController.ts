import { NextFunction, Response } from "express";
import Request from "../../shared/interfaces/Request";
import ServiceModel from "../../models/ServiceModel";
import { BaseKey } from "../../shared/constants/BaseKeyConstants";
import { ServiceAttachmentValidationSchema, ServiceCreateValidationSchema, ServiceListingParamsValidationSchema, ServiceUpdateValidationSchema } from "./ServiceController.validation";
import { ErrorModel } from "../../models/ErrorModel";
import { deserialize, serialize } from "serializr";
import { ServiceFilterSerializer, ServiceOrderSerializer, ServiceSerializer } from "../../serializers/ServiceSerializer";
import { removeFalsyKeys } from "../../shared/utils/removeFalsyKeys";
import { prisma } from "../../..";
import { Review } from "@prisma/client";
import { generateExcel, uploadToS3 } from "../../plugins/export";

const ServiceController = () => {

    const index = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const params = await ServiceListingParamsValidationSchema.validate(request.query, { stripUnknown: true })

            const orderBy = serialize(ServiceOrderSerializer, { ...params?.orderBy } as unknown)

            const filterBy = serialize(ServiceFilterSerializer, { ...params?.filterBy } as unknown)

            const serializedSortKeys = removeFalsyKeys(orderBy, true)

            const serializedFilterKeys = removeFalsyKeys(filterBy, true)

            if (serializedSortKeys)
                params.orderBy = serializedSortKeys
            else
                delete params?.orderBy

            if (serializedFilterKeys)
                params.filterBy = serializedFilterKeys
            else
                delete params?.filterBy

            const { services, meta } = await new ServiceModel().index(params as any)

            if (params.export) {
                const excelBuffer = await generateExcel("service", services);
                const url = await uploadToS3(excelBuffer, "service");
                return response
                    .status(200)
                    .json({
                        url
                    })
            }
            response
                .status(200)
                .json({ services: deserialize(ServiceSerializer, services), meta })

        } catch (error) {
            next(error)
        }
    }

    const create = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const body = await ServiceCreateValidationSchema.validate(request.body[BaseKey.SERVICE], { stripUnknown: true, abortEarly: false })

            const service = await new ServiceModel().create(body)
            response
                .status(200)
                .json({ service })

        } catch (error) {
            next(error)
        }
    }

    const update = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const serviceId = Number(request.params["serviceId"])

            if (!serviceId || isNaN(serviceId)) throw new ErrorModel({ statusCode: 422, message: "Service id missing!", name: "Invalid request" })

            const body = await ServiceUpdateValidationSchema.validate(request.body[BaseKey.SERVICE], { stripUnknown: true, abortEarly: false })

            const service = await new ServiceModel().update(serviceId, body as any)
            response
                .status(200)
                .json({ service })

        } catch (error) {
            next(error)
        }
    }

    const remove = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const serviceId = Number(request.params["serviceId"])

            if (!serviceId || isNaN(serviceId)) throw new ErrorModel({ statusCode: 422, message: "Service id missing!", name: "Invalid request" })

            await new ServiceModel().delete(serviceId)

            response
                .status(200)
                .json({})

        } catch (error) {
            next(error)
        }

    }

    const show = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const serviceId = Number(request.params["serviceId"])

            if (!serviceId || isNaN(serviceId)) throw new ErrorModel({ statusCode: 422, message: "Service id missing!", name: "Invalid request" })

            const service = await new ServiceModel().show(serviceId)
            response
                .status(200)
                .json({ service })

        } catch (error) {
            next(error)
        }
    }

    const indexAttachments = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const serviceId = Number(request.params["serviceId"])

            if (!serviceId || isNaN(serviceId)) throw new ErrorModel({ statusCode: 422, message: "Service id missing!", name: "Invalid request" })

            const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { attachments: true, videoAttachments: true } })

            response
                .status(200)
                .json({ service })

        } catch (error) {
            next(error)
        }
    }

    const createAttachment = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const serviceId = Number(request.params["serviceId"])

            if (!serviceId || isNaN(serviceId)) throw new ErrorModel({ statusCode: 422, message: "Service id missing!", name: "Invalid request" })

            const { attachmentId } = await ServiceAttachmentValidationSchema.validate(request.body[BaseKey.SERVICE], { stripUnknown: true, abortEarly: false })

            const service = await new ServiceModel().addAttachment(serviceId, attachmentId)

            response
                .status(200)
                .json({ service })

        } catch (error) {
            next(error)
        }
    }


    const locationSpecificIndex = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const addressId = Number(request.params["addressId"])

            let address;
            if (addressId && !isNaN(addressId))
                address = await prisma.address.findUnique({ where: { id: addressId }, include: { geolocation: true } })

            const latitude = request.latitude || address?.geolocation.latitude
            const longitude = request.longitude || address?.geolocation.longitude

            if (!latitude || !longitude)
                throw new ErrorModel({ statusCode: 422, name: "Invalid location specific request", message: "Geolocation headers missing!!" })

            // if (!addressId && (!request.latitude || !request.longitude))
            // throw new ErrorModel({ statusCode: 422, message: "Location data missing!", name: "Invalid request" })

            // let [finalizedLat, finalizedLong] = [request.latitude, request.longitude];

            // if (addressId) {
            //     const address = await prisma.address.findUnique({
            //         where: { id: addressId },
            //         include: { geolocation: true }
            //     })
            //     if (!address)
            //         throw new ErrorModel({ statusCode: 422, message: "Location data invalid!", name: "Invalid request" })

            //     finalizedLat = address.geolocation.latitude;
            //     finalizedLong = address.geolocation.longitude;
            // }

            const services = await new ServiceModel().getAvailableServices(latitude, longitude)

            //Todo
            //Use service type enum to segregate types of service requests

            response
                .status(200)
                .json({ services: deserialize(ServiceSerializer, services) })

        } catch (error) {
            next(error)
        }
    }

    const locationSpecificShow = async (request: Request, response: Response, next: NextFunction) => {
        try {

            if (!request.latitude || !request.longitude)
                throw new ErrorModel({ statusCode: 422, name: "Invalid location specific request", message: "Geolocation headers missing!!" })

            const serviceId = Number(request.params["serviceId"])

            if (!serviceId || isNaN(serviceId)) throw new ErrorModel({ statusCode: 422, message: "Service id missing!", name: "Invalid request" })

            let [finalizedLat, finalizedLong] = [request.latitude, request.longitude];

            const serviceModel = new ServiceModel()
            const [serviceData, reviewable] = await Promise.all([
                serviceModel.showIfAvailable(finalizedLat, finalizedLong, serviceId, request.user?.id),
                serviceModel.isReviewbleByUser(serviceId, request.user?.id)
            ])
            if (!serviceData)
                throw new ErrorModel({ statusCode: 422, message: "Unable to find requested service!", name: "Invalid request" })
            // const reviewable = serviceData?.service.active && request.user?.id && (serviceData?.service._count.reviews || 0) === 0 &&
            //     (serviceData?.service._count.bookings || 0) > 0

            const service = {
                ...serviceData?.service,
                reviewable
            }
            if (serviceData?.offer) {
                service.baseOfferId = serviceData?.offer.id
                service.baseOffer = serviceData?.offer
            }

            response
                .status(200)
                .json({ service })

        } catch (error) {
            next(error)
        }
    }

    const meta = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const services = await new ServiceModel().meta()
            response
                .status(200)
                .json({ services })

        } catch (error) {
            next(error)
        }
    }

    return {
        meta,
        show,
        index,
        create,
        update,
        remove,
        indexAttachments,
        createAttachment,
        locationSpecificShow,
        locationSpecificIndex,
    }
}

export default ServiceController