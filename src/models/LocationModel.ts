import GeolocationModel, { GeolocationParams, GeolocationUpdateParams } from './GeolocationModel';
import { Location, LocationRequest, PrismaClient } from "@prisma/client";
import { prisma } from "../..";
import { GlobalSearchParams } from './UserModel';
import { SortEnum } from '../shared/enum/sort-enum';
import { PAGE_LIMIT } from '../shared/constants/paginationMeta';
import { isWithinRadius } from '../shared/utils/calculateDistance';
import { getCityStatePincodeFromCoords } from '../plugins/map';

interface LocationParams {
    id?: number
    name: string
    radius: number
    active?: boolean
    geolocation: GeolocationParams
}
interface LocationUpdateParams {
    id?: number
    name?: string
    radius?: number
    active?: boolean
    geolocation?: GeolocationUpdateParams
}

type FilterKeys = {
    search?: string
    active?: boolean
}
type OrderKeys = "name" | "active" | "radius"

interface SearchParams extends GlobalSearchParams {
    orderBy?: Record<OrderKeys, SortEnum>
    filterBy?: FilterKeys
}

interface LocationListResponse {
    locations: Array<Location>,
    meta: SearchParams
}

interface LocationRequestListResponse {
    requests: Array<LocationRequest>,
    meta: SearchParams
}

class LocationModel {

    constructor(private readonly prismaLocation: PrismaClient["location"]) { }


    async index(params?: SearchParams): Promise<LocationListResponse> {

        const take = params?.limit || PAGE_LIMIT;
        const skip = ((params?.page || 1) - 1) * take;

        const where = {
            deleted: false
        };

        if (params?.filterBy?.search)
            Object.assign(where, {
                OR: [
                    { name: { contains: params.filterBy.search, mode: 'insensitive' } },
                ],
            });

        if (params?.filterBy?.active !== undefined || params?.filterBy?.active !== null)
            Object.assign(where, {
                active: params?.filterBy?.active
            });


        const locations = await this.prismaLocation.findMany({
            ...(!params?.export ? { take, skip } : {}),
            where,
            orderBy: params?.orderBy || { createdAt: "desc" },
            include: {
                geolocation: true,
                _count: {
                    select: {
                        bookings: true
                    }
                }
            }
        })

        const totalCount = await this.prismaLocation.count({ where })

        const meta: SearchParams = {
            page: 1,
            limit: PAGE_LIMIT,
            ...params,
            totalCount,
        }

        return { locations, meta }
    }

    async show(locationId: number) {
        return await this.prismaLocation.findFirst({ where: { id: locationId, deleted: false } })
    }

    async create(data: LocationParams): Promise<Location> {

        const location = await this.prismaLocation.create({
            data: {
                name: data.name,
                radius: data.radius,
                geolocation: {
                    create: data.geolocation
                }
            },
        })

        const [categories, subcategories, tasks] = await Promise.all([
            prisma.category.findMany(),
            prisma.subcategory.findMany(),
            prisma.task.findMany({ where: { service: { isAvailableEverywhere: false } }, include: { service: { include: { baseOffer: true } } } })
        ])

        const categoryLocations = []
        const subcategoryLocations = []
        const taskLocations = []

        const maximumLength = [categories.length, subcategories.length, tasks.length].sort((a, b) => b - a)[0]

        for (let index = 0; index < maximumLength; index++) {

            const category = categories[index]
            if (category) {
                const categoryLocation = {
                    locationId: location.id,
                    categoryId: category.id,
                    active: false
                }
                categoryLocations.push(categoryLocation)
            }

            const subcategory = subcategories[index]
            if (subcategory) {
                const subcategoryLocation = {
                    locationId: location.id,
                    subcategoryId: subcategory.id,
                    active: false
                }
                subcategoryLocations.push(subcategoryLocation)
            }

            const task = tasks[index]
            if (task?.service && task?.serviceId) {
                const offer = await prisma.offer.create({
                    data: {
                        offerType: task.service.baseOffer.offerType,
                        discount: task.service.baseOffer.discount,
                        minimumOrder: task.service.baseOffer.minimumOrder,
                        maximumDiscount: task.service.baseOffer.maximumDiscount,
                    }
                });
                const taskLocation = {
                    locationId: location.id,
                    taskId: task.id,
                    serviceId: task.serviceId,
                    offerId: offer.id,
                    cost: task.baseCost,
                    active: false
                }
                taskLocations.push(taskLocation)
            }

        }

        await Promise.all([prisma.categoryLocation.createMany({
            data: categoryLocations
        }),
        prisma.subcategoryLocation.createMany({
            data: subcategoryLocations
        }),
        prisma.taskLocation.createMany({
            data: taskLocations
        })])

        return location
    }


    async indexLocationRequests(params?: SearchParams): Promise<LocationRequestListResponse> {

        const take = params?.limit || PAGE_LIMIT;
        const skip = ((params?.page || 1) - 1) * take;

        const where = {
        };

        if (params?.filterBy?.search)
            Object.assign(where, {
                OR: [
                    { name: { contains: params.filterBy.search, mode: 'insensitive' } },
                ],
            });

        const requests = await prisma.locationRequest.findMany({
            take,
            skip,
            where,
            orderBy: { updatedAt: "desc" },
            include: {
                geolocation: true,
            }
        })

        const totalCount = await prisma.locationRequest.count({ where })

        const meta: SearchParams = {
            page: 1,
            limit: PAGE_LIMIT,
            ...params,
            totalCount,
        }

        return { meta, requests }
    }

    async getLocationRequest(latitude: number, longitude: number) {
        const city = (await getCityStatePincodeFromCoords(latitude, longitude))?.city

        return await prisma.locationRequest.findFirst({
            where: {
                geolocation: {
                    OR: [
                        { latitude, longitude },
                        { city }
                    ]
                }
            }
        })
    }

    async createLocationRequest(latitude: number, longitude: number) {
        const locationData = await getCityStatePincodeFromCoords(latitude, longitude)
        if (!locationData)
            return null;
        await prisma.locationRequest.create({
            data: {
                geolocation: {
                    create: {
                        latitude,
                        longitude,
                        ...locationData
                    }
                }
            }
        })
    }

    async incrementLocationRequest(requestId: number) {
        await prisma.locationRequest.update({
            where: {
                id: requestId
            },
            data: {
                requestCount: {
                    increment: 1
                }
            }
        })
    }

    async update(id: number, data: LocationUpdateParams): Promise<Location> {
        return await this.prismaLocation.update({
            where: { id },
            data: {
                name: data.name,
                radius: data.radius,
                active: data.active,
            },
            include: { geolocation: true }
        })
    }

    async delete(id: number): Promise<Location> {
        return await this.prismaLocation.update({
            where: { id },
            data: { deleted: true, active: false }
        })
    }

    async checkLocationFeasibility(latitude: number, longitude: number) {
        const locations = await prisma.location.findMany({
            where: {
                active: true
            },
            include: {
                geolocation: true
            }
        })

        return locations.find((location: { geolocation: { latitude: number; longitude: number; }; radius: number; }) => isWithinRadius(
            location.geolocation.latitude,
            location.geolocation.longitude,
            latitude,
            longitude,
            location.radius
        ))
    }

    async getFeasibleLocations(latitude: number, longitude: number) {
        const locations = await prisma.location.findMany({
            where: {
                active: true
            },
            include: {
                geolocation: true
            }
        })

        return locations.filter((location: { geolocation: { latitude: number; longitude: number; }; radius: number; }) => isWithinRadius(
            location.geolocation.latitude,
            location.geolocation.longitude,
            latitude,
            longitude,
            location.radius
        ))
    }
}

export default LocationModel