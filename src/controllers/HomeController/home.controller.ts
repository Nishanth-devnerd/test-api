import { HomeServicesCategorizeSchema, WebsiteContentUpdationSchema } from './../../validations/home';
import { NextFunction, Response } from "express";
import Request from "../../shared/interfaces/Request";
import FaqModel from "../../models/FaqModel";
import { BaseKey } from "../../shared/constants/BaseKeyConstants";
import { ErrorModel } from "../../models/ErrorModel";
import ServiceModel from "../../models/ServiceModel";
import { prisma } from "../../..";
import { deserialize, serialize } from "serializr";
import { ServiceMetaSerializer } from "../../serializers/ServiceSerializer";
import { CategoryMetaSerializer } from "../../serializers/CategorySerializer";
import { SubcategoryMetaSerializer } from "../../serializers/SubcategorySerializer";
import LocationModel from "../../models/LocationModel";
import HomeService from '../../services/home';
import { ApplicationContentEnum, HomeServicesEnum } from '@prisma/client';
import BlogModel from '../../models/BlogModel';
import { BlogMetaSerializer } from '../../serializers/BlogSerializer';

const HomeController = () => {

    const search = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const search = request.params["search"]?.toLowerCase()

            if (!search || !request.latitude || !request.longitude) throw new ErrorModel({ statusCode: 422, message: "Search value/Location data missing!", name: "Invalid request" })

            const availableServices = await new ServiceModel().getAvailableServices(request.latitude, request.longitude)

            const [categoryIds, subcategoryIds] = [
                Array.from(new Set(availableServices.map(service => service.categoryId))),
                Array.from(new Set(availableServices.map(service => service.subcategoryId)))]

            const [availableCategories, availableSubcategories, blogs] = await Promise.all([
                Promise.all(categoryIds.map(categoryId => prisma.category.findUnique({
                    where: {
                        id: categoryId,
                    }
                }))),
                Promise.all(subcategoryIds.map(subcategoryId => prisma.subcategory.findUnique({
                    where: {
                        id: subcategoryId,
                    }
                }))),
                new BlogModel().index({ filterBy: { search, isPublished: true }, limit: 100 }) // Limit 100 is passed to ensure no search result has been ignored
            ])

            const [services, subcategories, categories] = [
                availableServices.filter(service => service?.name.toLowerCase().includes(search) || service?.description.toLowerCase().includes(search)),
                availableSubcategories.filter(subcategory => subcategory?.name.toLowerCase().includes(search)),
                availableCategories.filter(category => category?.name.toLowerCase().includes(search) || category?.description.toLowerCase().includes(search)),
            ]

            response
                .status(200)
                .json({
                    services: serialize(ServiceMetaSerializer, services),
                    categories: serialize(CategoryMetaSerializer, categories),
                    subcategories: serialize(SubcategoryMetaSerializer, subcategories),
                    blogs: deserialize(BlogMetaSerializer, blogs.blogs)
                })
        } catch (error) {
            next(error)
        }
    }


    const checkLocationAvailability = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const [latitude, longitude] = [request.body["lat"], request.body["lng"]]

            if (!latitude || !longitude) throw new ErrorModel({ statusCode: 422, message: "Location data missing!", name: "Invalid request" })

            const locationModel = new LocationModel(prisma.location)

            const [feasibleLocation, locationRequest] = await Promise.all([
                locationModel.checkLocationFeasibility(latitude, longitude),
                locationModel.getLocationRequest(latitude, longitude),
            ])

            if (feasibleLocation)
                return response.status(200)
                    .json({
                        isServiceAvailable: true
                    })

            if (locationRequest)
                locationModel.incrementLocationRequest(locationRequest.id)
            else
                locationModel.createLocationRequest(latitude, longitude)

            response.status(200)
                .json({
                    isServiceAvailable: false
                })
        } catch (error) {
            next(error)
        }
    }

    const listCategorizedServices = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const type = request.params["type"]?.toLowerCase() as HomeServicesEnum
            const isAddable = Boolean(request.query["isAddable"])

            if (!type) throw new ErrorModel({ statusCode: 422, message: "Service type missing!", name: "Invalid request" })

            if (!Object.values(HomeServicesEnum).includes(type)) throw new ErrorModel({ statusCode: 422, message: "Service type missing!", name: "Invalid request" })

            const services = await new HomeService().index(type, isAddable)

            response.status(200)
                .json({
                    services
                })
        } catch (error) {
            next(error)
        }
    }

    const categorizeService = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const { type, serviceId, action } = await HomeServicesCategorizeSchema.validate(
                request.body[BaseKey.SERVICE],
                { stripUnknown: true, abortEarly: false }
            );

            const homeService = new HomeService()

            const isServiceCategorized = await homeService.find(type, serviceId)

            if (action === "add" && isServiceCategorized)
                throw new ErrorModel({ statusCode: 422, message: "Service already categorized!", name: "Invalid request" })

            if (action === "remove" && !isServiceCategorized)
                throw new ErrorModel({ statusCode: 422, message: "Service not categorized to remove!", name: "Invalid request" })

            const service = await homeService[action](type, serviceId)

            response.status(200)
                .json({
                    service
                })
        } catch (error) {
            next(error)
        }
    }

    const showContent = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const type = request.params["type"]?.toLowerCase() as ApplicationContentEnum

            if (!type) throw new ErrorModel({ statusCode: 422, message: "Service type missing!", name: "Invalid request" })

            if (!Object.values(ApplicationContentEnum).includes(type)) throw new ErrorModel({ statusCode: 422, message: "Service type missing!", name: "Invalid request" })

            const homeService = new HomeService()

            const content = (await homeService.showApplicationContent(type))?.content

            response.status(200)
                .json({
                    content
                })
        } catch (error) {
            next(error)
        }
    }

    const updateContent = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const { type, content } = await WebsiteContentUpdationSchema.validate(
                request.body[BaseKey.WEBSITE_CONTENT],
                { stripUnknown: true, abortEarly: false }
            );
            const homeService = new HomeService()

            const resp = (await homeService.updateApplicationContent(type, content))?.content

            response.status(200)
                .json({
                    content: resp
                })
        } catch (error) {
            next(error)
        }
    }

    return {
        search,
        showContent,
        updateContent,
        categorizeService,
        listCategorizedServices,
        checkLocationAvailability,
    }
}

export default HomeController