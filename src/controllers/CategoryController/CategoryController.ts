import { CategorySerializer, CategoryFilterSerializer } from './../../serializers/CategorySerializer';
import { NextFunction, Response } from "express";
import { prisma } from "../../..";
import CategoryModel from "../../models/CategoryModel";
import Request from "../../shared/interfaces/Request";
import { CategoryCreateValidationSchema, CategoryUpdateValidationSchema, CategoryListingParamsValidationSchema, categoryLocationUpdateValidationSchema } from "./CategoryController.validation";
import { removeFalsyKeys } from '../../shared/utils/removeFalsyKeys';
import { deserialize, serialize } from 'serializr';
import { BaseKey } from '../../shared/constants/BaseKeyConstants';
import { ErrorModel } from '../../models/ErrorModel';
import { LocationAvailablitySerializer } from '../../serializers/LocationSerializer';
import ServiceModel from '../../models/ServiceModel';

const CategoryController = () => {

    const index = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const params = await CategoryListingParamsValidationSchema.validate(request.query, { stripUnknown: true })

            const orderBy = serialize(CategorySerializer, { ...params?.orderBy } as unknown)

            const filterBy = serialize(CategoryFilterSerializer, { ...params?.filterBy } as unknown)

            const serializedSortKeys = removeFalsyKeys(orderBy, true) as CategorySerializer

            const serializedFilterKeys = removeFalsyKeys(filterBy, true) as CategoryFilterSerializer

            if (serializedSortKeys)
                params.orderBy = serializedSortKeys
            else
                delete params?.orderBy

            if (serializedFilterKeys)
                params.filterBy = serializedFilterKeys
            else
                delete params?.filterBy

            const { categories, meta } = await new CategoryModel(prisma.category).index(params as any)

            const serializedMeta = { ...meta }
            if (meta.orderBy)
                serializedMeta.orderBy = deserialize(CategorySerializer, meta.orderBy) as any
            if (meta.filterBy)
                serializedMeta.filterBy = deserialize(CategoryFilterSerializer, meta.filterBy) as any

            response
                .status(200)
                .json({ categories: deserialize(CategorySerializer, categories), meta: serializedMeta })
        } catch (error) {
            next(error)
        }
    }

    const locationsIndex = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const categoryId = Number(request.params["categoryId"])

            if (!categoryId || isNaN(categoryId)) throw new ErrorModel({ statusCode: 422, message: "Category id missing!", name: "Invalid request" })

            const locations = await new CategoryModel(prisma.category).locationsIndex(categoryId)

            response
                .status(200)
                .json({ locations: deserialize(LocationAvailablitySerializer, locations) })

        } catch (error) {
            next(error)
        }
    }

    const locationsUpdate = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const categoryId = Number(request.params["categoryId"])

            if (!categoryId || isNaN(categoryId)) throw new ErrorModel({ statusCode: 422, message: "Category id missing!", name: "Invalid request" })

            const body = await categoryLocationUpdateValidationSchema.validate(request.body[BaseKey.LOCATIONS], { stripUnknown: true })

            if (!body?.length) return;

            const locations = await new CategoryModel(prisma.category).locationsUpdate(categoryId, body)

            response
                .status(200)
                .json({ locations: deserialize(LocationAvailablitySerializer, locations) })

        } catch (error) {
            next(error)
        }
    }

    const show = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const categoryId = Number(request.params["categoryId"])

            if (!categoryId || isNaN(categoryId)) throw new ErrorModel({ statusCode: 422, message: "Category id missing!", name: "Invalid request" })

            const category = await new CategoryModel(prisma.category).show(categoryId)

            if (request.latitude && request.longitude) {

                const services = await new ServiceModel().getAvailableServices(request.latitude, request.longitude, { categoryId })

                const subcategoryIds = Array.from(new Set(services.map(service => service.subcategoryId)))

                const subcategories = (await Promise.all(subcategoryIds.map(subcategoryId => prisma.subcategory.findFirst({
                    where: {
                        id: subcategoryId,
                        categoryId,
                        deleted: false
                    },
                    include: {
                        attachment: true
                    }
                })))).filter(sub => !!sub)

                // If service and subcategories are not available, this location is not supported by the category
                if (!subcategories.length && !services.length)
                    throw new ErrorModel({ statusCode: 422, message: "Unable to find requested category!", name: "Invalid request" })

                return response
                    .status(200)
                    .json({
                        category: deserialize(CategorySerializer, category),
                        subcategories,
                        services
                    })
            }
            response
                .status(200)
                .json({ category: deserialize(CategorySerializer, category) })

        } catch (error) {
            next(error)
        }
    }

    const create = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const body = await CategoryCreateValidationSchema.validate(request.body[BaseKey.CATEGORY], { stripUnknown: true })

            const category = await new CategoryModel(prisma.category).create(body)

            response
                .status(201)
                .json({ category: deserialize(CategorySerializer, category) })

        } catch (error) {
            next(error)
        }

    }

    const update = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const categoryId = Number(request.params["categoryId"])

            if (!categoryId || isNaN(categoryId)) throw new ErrorModel({ statusCode: 422, message: "Category id missing!", name: "Invalid request" })

            const body = await CategoryUpdateValidationSchema.validate(request.body[BaseKey.CATEGORY], { stripUnknown: true })

            const category = await new CategoryModel(prisma.category).update(categoryId, body as any)

            response
                .status(200)
                .json({ category: deserialize(CategorySerializer, category) })

        } catch (error) {
            next(error)
        }
    }

    const remove = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const categoryId = Number(request.params["categoryId"])

            if (!categoryId || isNaN(categoryId)) throw new ErrorModel({ statusCode: 422, message: "Category id missing!", name: "Invalid request" })

            await new CategoryModel(prisma.category).delete(categoryId)

            response
                .status(200)
                .json({})

        } catch (error) {
            next(error)
        }

    }

    const metaIndex = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const categories = await new CategoryModel(prisma.category).meta()

            response
                .status(200)
                .json({ categories })

        } catch (error) {
            next(error)
        }

    }

    const locationSpecificIndex = async (request: Request, response: Response, next: NextFunction) => {
        try {
            if (!request.latitude || !request.longitude)
                throw new ErrorModel({ statusCode: 422, name: "Invalid location specific request", message: "Geolocation headers missing!!" })
            const feasibleServices = await new ServiceModel().getAvailableServices(request.latitude, request.longitude)
            const categoryIds = Array.from(new Set(feasibleServices.map(service => service.categoryId)))
            const categories = await Promise.all(categoryIds.map(categoryId => prisma.category.findUnique({ where: { id: categoryId }, include: { attachment: true } })))
            response
                .status(200)
                .json({ categories })
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
        metaIndex,
        locationsIndex,
        locationsUpdate,
        locationSpecificIndex,
    }
}

export default CategoryController