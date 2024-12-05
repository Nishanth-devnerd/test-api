import { SubcategorySerializer, SubcategoryFilterSerializer } from './../../serializers/SubcategorySerializer';
import { NextFunction, Response } from "express";
import { prisma } from "../../..";
import SubcategoryModel from "../../models/SubcategoryModel";
import Request from "../../shared/interfaces/Request";
import { SubcategoryCreateValidationSchema, SubcategoryUpdateValidationSchema, SubcategoryListingParamsValidationSchema, subcategoryLocationUpdateValidationSchema } from "./SubcategoryController.validation";
import { removeFalsyKeys } from '../../shared/utils/removeFalsyKeys';
import { deserialize, serialize } from 'serializr';
import { BaseKey } from '../../shared/constants/BaseKeyConstants';
import { ErrorModel } from '../../models/ErrorModel';
import { LocationAvailablitySerializer } from '../../serializers/LocationSerializer';

const SubcategoryController = () => {

    const index = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const categoryId = Number(request.params["categoryId"])

            if (!categoryId || isNaN(categoryId)) throw new ErrorModel({ statusCode: 422, message: "Category id missing!", name: "Invalid request" })

            const params = await SubcategoryListingParamsValidationSchema.validate(request.query, { stripUnknown: true })

            const orderBy = serialize(SubcategorySerializer, { ...params?.orderBy } as unknown)

            const filterBy = serialize(SubcategoryFilterSerializer, { ...params?.filterBy } as unknown)

            const serializedSortKeys = removeFalsyKeys(orderBy, true) as SubcategorySerializer

            const serializedFilterKeys = removeFalsyKeys(filterBy, true) as SubcategoryFilterSerializer

            if (serializedSortKeys)
                params.orderBy = serializedSortKeys
            else
                delete params?.orderBy

            if (serializedFilterKeys)
                params.filterBy = serializedFilterKeys
            else
                delete params?.filterBy

            const { subcategories, meta } = await new SubcategoryModel(prisma.subcategory).index(categoryId, params as any)

            const serializedMeta = { ...meta }
            if (meta.orderBy)
                serializedMeta.orderBy = deserialize(SubcategorySerializer, meta.orderBy) as any
            if (meta.filterBy)
                serializedMeta.filterBy = deserialize(SubcategoryFilterSerializer, meta.filterBy) as any

            response
                .status(200)
                .json({ subcategories: deserialize(SubcategorySerializer, subcategories), meta: serializedMeta })
        } catch (error) {
            next(error)
        }
    }

    const show = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const subcategoryId = Number(request.params["subcategoryId"])

            if (!subcategoryId || isNaN(subcategoryId)) throw new ErrorModel({ statusCode: 422, message: "Subategory id missing!", name: "Invalid request" })

            const subcategory = await new SubcategoryModel(prisma.subcategory).show(subcategoryId)

            response
                .status(200)
                .json({ subcategory: deserialize(SubcategorySerializer, subcategory) })

        } catch (error) {
            next(error)
        }
    }

    const locationsIndex = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const subcategoryId = Number(request.params["subcategoryId"])

            if (!subcategoryId || isNaN(subcategoryId)) throw new ErrorModel({ statusCode: 422, message: "Subcategory id missing!", name: "Invalid request" })

            const locations = await new SubcategoryModel(prisma.subcategory).locationsIndex(subcategoryId)

            response
                .status(200)
                .json({ locations: deserialize(LocationAvailablitySerializer, locations) })

        } catch (error) {
            next(error)
        }
    }

    const locationsUpdate = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const subcategoryId = Number(request.params["subcategoryId"])

            if (!subcategoryId || isNaN(subcategoryId)) throw new ErrorModel({ statusCode: 422, message: "Subcategory id missing!", name: "Invalid request" })

            const body = await subcategoryLocationUpdateValidationSchema.validate(request.body[BaseKey.LOCATIONS], { stripUnknown: true })

            if (!body?.length) return;

            const locations = await new SubcategoryModel(prisma.subcategory).locationsUpdate(subcategoryId, body as any)

            response
                .status(200)
                .json({ locations: deserialize(LocationAvailablitySerializer, locations) })

        } catch (error) {
            next(error)
        }
    }

    const create = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const categoryId = Number(request.params["categoryId"])

            if (!categoryId || isNaN(categoryId)) throw new ErrorModel({ statusCode: 422, message: "Category id missing!", name: "Invalid request" })

            const body = await SubcategoryCreateValidationSchema.validate(request.body[BaseKey.SUBCATEGORY], { stripUnknown: true })

            const subcategory = await new SubcategoryModel(prisma.subcategory).create(body)

            response
                .status(201)
                .json({ subcategory: deserialize(SubcategorySerializer, subcategory) })

        } catch (error) {
            next(error)
        }

    }

    const update = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const categoryId = Number(request.params["categoryId"])
            if (!categoryId || isNaN(categoryId)) throw new ErrorModel({ statusCode: 422, message: "Category id missing!", name: "Invalid request" })

            const subcategoryId = Number(request.params["subcategoryId"])
            if (!subcategoryId || isNaN(subcategoryId)) throw new ErrorModel({ statusCode: 422, message: "Subcategory id missing!", name: "Invalid request" })

            const body = await SubcategoryUpdateValidationSchema.validate(request.body[BaseKey.SUBCATEGORY], { stripUnknown: true })

            const subcategory = await new SubcategoryModel(prisma.subcategory).update(subcategoryId, body as any)

            response
                .status(200)
                .json({ subcategory: deserialize(SubcategorySerializer, subcategory) })

        } catch (error) {
            next(error)
        }
    }

    const remove = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const categoryId = Number(request.params["categoryId"])
            if (!categoryId || isNaN(categoryId)) throw new ErrorModel({ statusCode: 422, message: "Category id missing!", name: "Invalid request" })

            const subcategoryId = Number(request.params["subcategoryId"])
            if (!subcategoryId || isNaN(subcategoryId)) throw new ErrorModel({ statusCode: 422, message: "Subcategory id missing!", name: "Invalid request" })

            await new SubcategoryModel(prisma.subcategory).delete(subcategoryId)

            response
                .status(200)
                .json({})

        } catch (error) {
            next(error)
        }

    }

    const metaIndex = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const categoryId = Number(request.query["categoryId"])

            const subcategories = await new SubcategoryModel(prisma.subcategory).meta(!isNaN(categoryId) ? categoryId : null)

            response
                .status(200)
                .json({ subcategories })

        } catch (error) {
            next(error)
        }

    }

    // const locationSpecificIndex = async (request: Request, response: Response, next: NextFunction) => {
    //     try {

    //         const categoryId = Number(request.params["categoryId"])

    //         if (!categoryId|| isNaN(categoryId)) throw new ErrorModel({ statusCode: 422, message: "Category id missing!", name: "Invalid request" })

    //         if (!request.latitude || !request.longitude)
    //             throw new ErrorModel({ statusCode: 422, name: "Invalid location specific request", message: "Geolocation headers missing!!" })

    //         const feasibleServices = await new SubcategoryModel(prisma.subcategory)
    //             .getAvailableServices(request.latitude, request.longitude, categoryId)
    //         const subcategoryIds = Array.from(new Set(feasibleServices.map(service => service.subcategoryId)))
    //         const subcategories = await Promise.all(subcategoryIds.map(categoryId => prisma.subcategory.findUnique({ where: { id: categoryId } })))
    //         response
    //             .status(200)
    //             .json({ subcategories })
    //     } catch (error) {

    //     }
    // }

    return {
        show,
        index,
        create,
        update,
        remove,
        metaIndex,
        locationsIndex,
        locationsUpdate,
        // locationSpecificIndex,
    }
}

export default SubcategoryController