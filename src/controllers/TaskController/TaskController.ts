import { NextFunction, Response } from "express";
import Request from "../../shared/interfaces/Request";
import TaskModel from "../../models/TaskModel";
import { BaseKey } from "../../shared/constants/BaseKeyConstants";
import { ErrorModel } from "../../models/ErrorModel";
import { TaskCreateValidationSchema, TaskUpdateValidationSchema, taskLocationUpdateValidationSchema } from "./TaskController.validation";
import { deserialize } from "serializr";
import { LocationAvailablitySerializer } from "../../serializers/LocationSerializer";
import { TaskSerializer } from "../../serializers/TaskSerializer";
import { prisma } from "../../..";

const TaskController = () => {

    const index = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const serviceId = Number(request.params["serviceId"])

            if (!serviceId || isNaN(serviceId)) throw new ErrorModel({ statusCode: 422, message: "Service id missing!", name: "Invalid request" })

            const tasks = await new TaskModel().index(serviceId)

            response
                .status(200)
                .json({ tasks })
        } catch (error) {
            next(error)
        }
    }

    const locationSpecificIndex = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const serviceId = Number(request.params["serviceId"])
            const addressId = Number(request.address?.id)
            const latitude = request.latitude
            const longitude = request.longitude

            let message;
            if (!serviceId || isNaN(serviceId))
                message = "Service id missing!"
            if ((!addressId || isNaN(addressId)) && !(latitude && longitude))
                message = "Address id missing!"

            if (message)
                throw new ErrorModel({ statusCode: 422, message, name: "Invalid request" })

            let fetchRequest;
            if (addressId)
                fetchRequest = new TaskModel().addressSpecificIndex(serviceId, addressId)
            else if (latitude && longitude)
                fetchRequest = new TaskModel().locationSpecificIndex(serviceId, latitude, longitude)

            const tasks = await fetchRequest

            response
                .status(200)
                .json({
                    tasks: deserialize(TaskSerializer, tasks),
                })

        } catch (error) {
            next(error)
        }
    }



    const locationsIndex = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const serviceId = Number(request.params["serviceId"])
            if (!serviceId || isNaN(serviceId)) throw new ErrorModel({ statusCode: 422, message: "Service id missing!", name: "Invalid request" })

            const taskId = Number(request.params["taskId"])
            if (!taskId || isNaN(taskId)) throw new ErrorModel({ statusCode: 422, message: "Task id missing!", name: "Invalid request" })

            const locations = await new TaskModel().locationsIndex(serviceId, taskId)

            response
                .status(200)
                .json({ locations: deserialize(LocationAvailablitySerializer, locations) })

        } catch (error) {
            next(error)
        }
    }

    const locationsUpdate = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const serviceId = Number(request.params["serviceId"])
            if (!serviceId || isNaN(serviceId)) throw new ErrorModel({ statusCode: 422, message: "Subcategory id missing!", name: "Invalid request" })

            const taskId = Number(request.params["taskId"])
            if (!taskId || isNaN(taskId)) throw new ErrorModel({ statusCode: 422, message: "Subcategory id missing!", name: "Invalid request" })

            const body = await taskLocationUpdateValidationSchema.validate(request.body[BaseKey.LOCATIONS], { stripUnknown: true })

            if (!body?.length) return;

            const locations = await new TaskModel().locationsUpdate(serviceId, taskId, body)

            response
                .status(200)
                .json({ locations: deserialize(LocationAvailablitySerializer, locations) })

        } catch (error) {
            next(error)
        }
    }

    const create = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const body = await TaskCreateValidationSchema.validate(request.body[BaseKey.TASK], { stripUnknown: true, abortEarly: false })

            const task = await new TaskModel().create(body)
            response
                .status(200)
                .json({ task })

        } catch (error) {
            next(error)
        }
    }

    const update = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const serviceId = Number(request.params["serviceId"])

            const taskId = Number(request.params["taskId"])

            if (!serviceId || isNaN(serviceId)) throw new ErrorModel({ statusCode: 422, message: "Service id missing!", name: "Invalid request" })

            if (!taskId || isNaN(taskId)) throw new ErrorModel({ statusCode: 422, message: "Task id missing!", name: "Invalid request" })

            const body = await TaskUpdateValidationSchema.validate(request.body[BaseKey.TASK], { stripUnknown: true, abortEarly: false })

            const task = await new TaskModel().update(serviceId, taskId, body)
            response
                .status(200)
                .json({ task })

        } catch (error) {
            next(error)
        }
    }

    const remove = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const taskId = Number(request.params["taskId"])

            if (!taskId || isNaN(taskId)) throw new ErrorModel({ statusCode: 422, message: "Faq id missing!", name: "Invalid request" })

            await new TaskModel().delete(taskId)
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
        update,
        remove,
        locationsIndex,
        locationsUpdate,
        locationSpecificIndex,
    }
}

export default TaskController