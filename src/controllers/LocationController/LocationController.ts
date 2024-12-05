import { LocationSerializer, LocationFilterSerializer, LocationRequestFilterSerializer } from './../../serializers/LocationSerializer';
import { NextFunction, Response } from "express";
import { prisma } from "../../..";
import Request from "../../shared/interfaces/Request";
import { removeFalsyKeys } from '../../shared/utils/removeFalsyKeys';
import { deserialize, serialize } from 'serializr';
import { BaseKey } from '../../shared/constants/BaseKeyConstants';
import { ErrorModel } from '../../models/ErrorModel';
import { LocationListingParamsValidationSchema, LocationUpdateValidationSchema, LocationValidationSchema } from './LocationController.validation';
import LocationModel from '../../models/LocationModel';
import GeolocationModel from '../../models/GeolocationModel';
import { generateExcel, uploadToS3 } from '../../plugins/export';

const LocationController = () => {

    const index = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const params = await LocationListingParamsValidationSchema.validate(request.query, { stripUnknown: true })

            const orderBy = serialize(LocationSerializer, { ...params?.orderBy } as unknown)

            const filterBy = serialize(LocationFilterSerializer, { ...params?.filterBy } as unknown)

            const serializedSortKeys = removeFalsyKeys(orderBy, true) as LocationSerializer

            const serializedFilterKeys = removeFalsyKeys(filterBy, true) as LocationFilterSerializer

            if (serializedSortKeys)
                params.orderBy = serializedSortKeys
            else
                delete params?.orderBy

            if (serializedFilterKeys)
                params.filterBy = serializedFilterKeys
            else
                delete params?.filterBy
            const { locations, meta } = await new LocationModel(prisma.location).index(params as any)

            if (params.export) {
                const excelBuffer = await generateExcel("location", locations);
                const url = await uploadToS3(excelBuffer, "location");
                return response
                    .status(200)
                    .json({
                        url
                    })
            }

            const serializedMeta = { ...meta }
            if (meta.orderBy)
                serializedMeta.orderBy = deserialize(LocationSerializer, meta.orderBy) as any
            if (meta.filterBy)
                serializedMeta.filterBy = deserialize(LocationFilterSerializer, meta.filterBy) as any

            response
                .status(200)
                .json({
                    locations: deserialize(LocationSerializer, locations),
                    meta: serializedMeta,
                })
        } catch (error) {
            console.log(error)
            next(error)
        }
    }

    const show = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const locationId = Number(request.params["locationId"])

            if (!locationId || isNaN(locationId)) throw new ErrorModel({ statusCode: 422, message: "Location id missing!", name: "Invalid request" })

            const location = await new LocationModel(prisma.location).show(locationId)

            response
                .status(200)
                .json({ location: deserialize(LocationSerializer, location) })

        } catch (error) {
            next(error)
        }
    }

    const create = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const body = await LocationValidationSchema.validate(request.body[BaseKey.LOCATION], { stripUnknown: true })

            const location = await new LocationModel(prisma.location).create(body)

            response
                .status(201)
                .json({ location: deserialize(LocationSerializer, location) })

        } catch (error) {
            next(error)
        }

    }

    const update = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const locationId = Number(request.params["locationId"])

            if (!locationId || isNaN(locationId)) throw new ErrorModel({ statusCode: 422, message: "Location id missing!", name: "Invalid request" })

            const body = await LocationUpdateValidationSchema.validate(request.body[BaseKey.LOCATION], { stripUnknown: true })

            if (body.geolocation.id)
                await new GeolocationModel(prisma.geolocation).update(body.geolocation.id, body.geolocation)

            const location = await new LocationModel(prisma.location).update(locationId, body)

            response
                .status(200)
                .json({ location: deserialize(LocationSerializer, location) })

        } catch (error) {
            next(error)
        }
    }

    const remove = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const locationId = Number(request.params["locationId"])

            if (!locationId || isNaN(locationId)) throw new ErrorModel({ statusCode: 422, message: "Location id missing!", name: "Invalid request" })

            await new LocationModel(prisma.location).delete(locationId)

            response
                .status(200)
                .json({})

        } catch (error) {
            next(error)
        }

    }

    const requestsIndex = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const params = await LocationListingParamsValidationSchema.validate(request.query, { stripUnknown: true })

            const filterBy = serialize(LocationRequestFilterSerializer, { ...params?.filterBy } as unknown)

            const serializedFilterKeys = removeFalsyKeys(filterBy, true) as LocationFilterSerializer

            if (serializedFilterKeys)
                params.filterBy = serializedFilterKeys
            else
                delete params?.filterBy

            const { requests, meta } = await new LocationModel(prisma.location).indexLocationRequests(params as any)

            const serializedMeta = { ...meta }
            if (meta.filterBy)
                serializedMeta.filterBy = deserialize(LocationFilterSerializer, meta.filterBy) as any

            response
                .status(200)
                .json({
                    requests,
                    meta: serializedMeta,
                })
        } catch (error) {
            next(error)
        }
    }
    return {
        show,
        index,
        create,
        update,
        remove,
        requestsIndex,
    }
}

export default LocationController