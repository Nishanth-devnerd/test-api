import { Task } from "@prisma/client";
import { prisma } from "../..";
import { LocationAvailablityUpdateParams } from "./CategoryModel";
import { ErrorModel } from "./ErrorModel";
import { isWithinRadius } from "../shared/utils/calculateDistance";
import { calculateTotalCost } from "../shared/utils/calculateTotalCost";
import { isInServiceableRegion } from "../shared/utils/isInServiceableRegion";

export interface TaskParams {
    id?: number
    name: string
    duration: number
    baseCost: number
    serviceId: number
}

export interface TaskUpdateParams {
    id?: number
    name?: string
    duration?: number
    baseCost?: number
    serviceId?: number
}

interface TaskLocationAvailablityUpdateParams extends LocationAvailablityUpdateParams {
    cost?: number
    offer: {
        id: number
        discount: number
        validTill?: Date | null
        minimumOrder?: number | null
        maximumDiscount?: number | null
    }
}

type TaskLocationCreateManyInput = {
    taskId: number
    serviceId: number
    locationId: number
    cost: number
    offerId: number
    active?: boolean
}

class TaskModel {
    prismaTask;
    constructor() {
        this.prismaTask = prisma.task;
    }

    async index(serviceId: number): Promise<Array<Task>> {
        return this.prismaTask.findMany({
            where: { serviceId },
            orderBy: { name: "asc" }
        })
    }

    async addressSpecificIndex(serviceId: number, addressId: number) {

        const [taskLocations, address, service] = await Promise.all([prisma.taskLocation.findMany({
            where: {
                serviceId,
                active: true,
                location: {
                    active: true,
                    deleted: false
                }
            },
            include: {
                location: {
                    include: {
                        geolocation: true
                    }
                },
                task: true,
                offer: true,
            }
        }),
        prisma.address.findUnique({ where: { id: addressId }, include: { geolocation: true } }),
        prisma.service.findUnique({ where: { id: serviceId }, include: { baseOffer: true, tasks: true } })
        ])

        if (!service?.id) throw new ErrorModel({ statusCode: 422, name: "No service with id", message: "Service not found" })

        if (service.isAvailableEverywhere
            && address?.geolocation.latitude
            && address?.geolocation.longitude
            && await isInServiceableRegion(address?.geolocation.latitude, address?.geolocation.longitude))
            return await Promise.all(service.tasks.map(async (task) => {
                const bestOffer = calculateTotalCost(task.baseCost, service.baseOffer)
                const bestOfferData = await (bestOffer?.[1] ? prisma.offer.findUnique({ where: { id: bestOffer?.[1] } }) : null)
                const totalCostAfterOfferApplied = bestOffer?.[0] || calculateTotalCost(task.baseCost, bestOfferData)[0]
                return { ...(task), baseCost: task.baseCost, actualCost: totalCostAfterOfferApplied }
            }))

        const addressLat = address?.geolocation.latitude
        const addressLong = address?.geolocation.longitude

        if (!addressLat || !addressLong)
            throw new ErrorModel({
                code: 422,
                message: "Invalid address coordinates",
                name: "Address invalid"
            })

        const filteredTasks = taskLocations.filter((taskLocation) => {
            return isWithinRadius(addressLat,
                addressLong,
                taskLocation.location.geolocation.latitude,
                taskLocation.location.geolocation.longitude,
                taskLocation.location.radius
            )
        }
        )

        return await Promise.all(filteredTasks.map(async (task) => {

            const bestOffer = calculateTotalCost(task.cost, task.offer)

            const bestOfferData = bestOffer?.[1] ? await prisma.offer.findUnique({ where: { id: bestOffer?.[1] } }) : null


            const totalCostAfterOfferApplied = bestOffer?.[0] || calculateTotalCost(task.cost, bestOfferData)[0]

            return { ...(task.task), baseCost: task.cost, actualCost: totalCostAfterOfferApplied }
        }))
    }

    async locationSpecificIndex(serviceId: number, latitude: number, longitude: number) {

        const [taskLocations, service] = await Promise.all([prisma.taskLocation.findMany({
            where: {
                serviceId,
                active: true
            },
            include: {
                location: {
                    include: {
                        geolocation: true
                    }
                },
                offer: true,
                task: true
            }
        }),
        prisma.service.findUnique({ where: { id: serviceId }, include: { baseOffer: true, tasks: true } })
        ])

        if (!service?.id) throw new ErrorModel({ statusCode: 422, name: "No service with id", message: "Service not found" })

        if (service.isAvailableEverywhere
            && await isInServiceableRegion(latitude, longitude))
            return await Promise.all(service.tasks.map(async (task) => {
                const bestOffer = calculateTotalCost(task.baseCost, service.baseOffer)
                const bestOfferData = await (bestOffer?.[1] ? prisma.offer.findUnique({ where: { id: bestOffer?.[1] } }) : null)
                const totalCostAfterOfferApplied = bestOffer?.[0] || calculateTotalCost(task.baseCost, bestOfferData)[0]
                return { ...(task), baseCost: task.baseCost, actualCost: totalCostAfterOfferApplied }
            }))

        const filteredTasks = taskLocations.filter((taskLocation) =>
            isWithinRadius(latitude,
                longitude,
                taskLocation.location.geolocation.latitude,
                taskLocation.location.geolocation.longitude,
                taskLocation.location.radius
            )
        )
        // .map(taskLocation => ({ ...(taskLocation.task), baseCost: taskLocation.cost }))

        // if (!service?.id) throw new ErrorModel({ statusCode: 422, name: "No service with id", message: "Service not found" })


        return await Promise.all(filteredTasks.map(async (task) => {

            const bestOffer = calculateTotalCost(task.cost, task.offer)

            const bestOfferData = bestOffer?.[1] ? await prisma.offer.findUnique({ where: { id: bestOffer?.[1] } }) : null


            const totalCostAfterOfferApplied = bestOffer?.[0] || calculateTotalCost(task.cost, bestOfferData)[0]

            return { ...(task.task), baseCost: task.cost, actualCost: totalCostAfterOfferApplied }
        }))

    }

    async locationsIndex(serviceId: number, taskId: number) {
        // return await prisma.taskLocation.findMany({})
        return await prisma.taskLocation.findMany({
            where: { serviceId, taskId, location: { deleted: false } },
            // include: { location: true, offer: true },
            orderBy: { location: { name: "asc" } },
            select: {
                active: true, location: true, locationId: true, cost: true,
                offer: true
            }
        })
    }


    async locationsUpdate(serviceId: number, taskId: number, locations: TaskLocationAvailablityUpdateParams[]) {
        for (const data of locations) {
            const locationPromise = prisma.taskLocation.updateMany({
                where: {
                    taskId,
                    serviceId,
                    locationId: data.locationId,
                },
                data: {
                    active: data.active,
                    cost: data.cost,
                },
            })

            const date = new Date();
            // date.setDate(date.getDate() - 1);
            const isExpired = data.offer.validTill ? data.offer.validTill < date : false;

            const offerPromise = prisma.offer.updateMany({
                where: {
                    id: data.offer.id
                },
                data: {
                    isExpired,
                    discount: data.offer.discount,
                    validTill: data.offer.validTill,
                    minimumOrder: data.offer.minimumOrder,
                    maximumDiscount: data.offer.maximumDiscount,
                }
            })
            await Promise.all([locationPromise, offerPromise]);
        }

        return await prisma.taskLocation.findMany({
            where: { taskId, serviceId },
            // include: { location: true, offer: true },
            orderBy: { location: { name: "asc" } },
            select: {
                active: true, location: true, locationId: true,
                offer: true
            }
        })
    }

    async create(data: TaskParams) {
        const task = await this.prismaTask.create({
            data,
            include: {
                service: {
                    include: {
                        baseOffer: true
                    }
                }
            }
        })

        const locations = await prisma.location.findMany({ select: { id: true }, where: { deleted: false } })

        const taskLocations: Array<TaskLocationCreateManyInput> = []
        if (task.service && task.serviceId && !task.service.isAvailableEverywhere)
            for (const location of locations) {
                const offer = await prisma.offer.create({
                    data: {
                        offerType: task.service.baseOffer.offerType,
                        discount: task.service.baseOffer.discount,
                        validTill: task.service.baseOffer.validTill,
                        minimumOrder: task.service.baseOffer.minimumOrder,
                        maximumDiscount: task.service.baseOffer.maximumDiscount,
                    }
                });
                taskLocations.push({
                    taskId: task.id,
                    locationId: location.id,
                    serviceId: task.serviceId,
                    cost: task.baseCost,
                    offerId: offer.id
                })
            }

        await prisma.taskLocation.createMany({ data: taskLocations })

        return task

    }

    async update(serviceId: number, taskId: number, data: TaskUpdateParams): Promise<Task> {
        const task = await this.prismaTask.update({
            where: { id: taskId },
            data: {
                serviceId,
                name: data.name,
                duration: data.duration,
                baseCost: data.baseCost,
            }
        })

        return task
    }

    async delete(id: number): Promise<void> {
        await this.prismaTask.delete({
            where: { id }
        })
        return;
    }

}

export default TaskModel