import { GlobalSearchParams } from './UserModel';
import { Subcategory, PrismaClient, } from "@prisma/client";
import { SortEnum } from '../shared/enum/sort-enum';
import { PAGE_LIMIT } from '../shared/constants/paginationMeta';
import { prisma } from '../..';
import { LocationAvailablityUpdateParams, } from './CategoryModel';
import { isWithinRadius } from '../shared/utils/calculateDistance';
import moment from 'moment';
import ServiceModel from './ServiceModel';

type SubcategoryLocationCreateManyInput = {
    subcategoryId: number
    locationId: number
    active?: boolean
}

type SubcategoryParams = {
    name: string
    categoryId: number
    attachmentId: number
}

type SubcategoryUpdateParams = {
    id?: number
    name?: string
    categoryId?: number
    attachmentId?: number
    active?: boolean
}

type OrderKeys = "name" | "active"

type FilterKeys = {
    search?: string
    active?: boolean
    categoryId?: number
}

interface SearchParams extends GlobalSearchParams {
    orderBy?: Record<OrderKeys, SortEnum>
    filterBy?: FilterKeys
}

interface SubcategoriesListResponse {
    subcategories: Array<Subcategory>,
    meta: SearchParams
}

class SubcategoryModel {

    constructor(
        private readonly prismaSubcategory: PrismaClient['subcategory'],
    ) { }

    async index(categoryId: number, params?: SearchParams): Promise<SubcategoriesListResponse> {

        const take = params?.limit || PAGE_LIMIT;
        const skip = ((params?.page || 1) - 1) * take;

        const where = {
            categoryId,
            deleted: false
        };

        if (params?.filterBy?.search)
            Object.assign(where, {
                OR: [
                    { name: { contains: params.filterBy.search, mode: 'insensitive' } },
                ],
            });

        if (params?.filterBy?.categoryId)
            Object.assign(where, {
                category: { id: params?.filterBy?.categoryId }
            });

        if (params?.filterBy?.active !== undefined || params?.filterBy?.active !== null)
            Object.assign(where, {
                active: params?.filterBy?.active
            });

        const subcategories = await this.prismaSubcategory.findMany({
            take,
            skip,
            where,
            orderBy: params?.orderBy || { createdAt: "desc" },
            include: {
                category: true,
                attachment: true, _count: {
                    select: {
                        services: true,
                        bookings: true,
                    }
                }
            },
        })

        const totalCount = await this.prismaSubcategory.count({ where })

        const meta: SearchParams = {
            page: 1,
            limit: PAGE_LIMIT,
            ...params,
            totalCount,

        }
        return { subcategories, meta }
    }

    async meta(categoryId?: number | null) {
        const where = {
            deleted: false
        }

        if (categoryId)
            Object.assign(where, { categoryId })

        return await this.prismaSubcategory.findMany({
            where,
            select: { id: true, name: true }
        })
    }

    async show(categoryId: number) {
        return await this.prismaSubcategory.findUnique({
            where: { id: categoryId },
            include: {
                subategoryLocations: { include: { location: true } }, category: true, services: {
                    where: { deleted: false },
                    include: {
                        attachments: true,
                        videoAttachments: true,
                        _count: {
                            select: {
                                bookings: true
                            }
                        }
                    }
                },
                _count: true, attachment: true
            },

        })
    }

    async locationsIndex(subcategoryId: number) {
        return await prisma.subcategoryLocation.findMany({
            where: {
                subcategoryId, location: {
                    deleted: false
                }
            },
            include: { location: true }
        })
    }

    async locationsUpdate(subcategoryId: number, locations: LocationAvailablityUpdateParams[]) {
        for (const data of locations) {
            await prisma.subcategoryLocation.updateMany({
                where: {
                    subcategoryId,
                    locationId: data.locationId,
                },
                data: {
                    active: data.active,
                },
            })
        }

        return await prisma.subcategoryLocation.findMany({
            where: { subcategoryId, location: { deleted: false } },
            // include: { location: true },
            orderBy: { location: { name: "asc" } },
            select: {
                active: true, location: true, locationId: true,
            }
        })
    }

    async create(data: SubcategoryParams): Promise<Subcategory | null> {

        const subcategory = await this.prismaSubcategory.create({
            data: {
                name: data.name,
                category: {
                    connect: {
                        id: data.categoryId
                    }
                },
                attachment: {
                    connect: {
                        id: data.attachmentId
                    }
                }
            }
        })

        const locations = await prisma.location.findMany({ select: { id: true } })
        const subcategoryLocations: Array<SubcategoryLocationCreateManyInput> = []

        for (const location of locations) {
            subcategoryLocations.push({
                locationId: location.id,
                subcategoryId: subcategory.id,
            })
        }

        await prisma.subcategoryLocation.createMany(
            { data: subcategoryLocations, skipDuplicates: true })

        return await this.prismaSubcategory.findUnique({
            where: {
                id: subcategory.id,
            },
            include: {
                category: true,
                attachment: true
            }
        })
    }

    async update(id: number, data: SubcategoryUpdateParams): Promise<Subcategory> {

        return await this.prismaSubcategory.update(
            {
                where: { id },
                data: {
                    name: data.name,
                    active: data.active,
                    ...(data.categoryId
                        ? {
                            category: {
                                connect: {
                                    id: data.categoryId
                                }
                            }
                        }
                        : {}),
                    ...(data.attachmentId
                        ? {
                            attachment: {
                                connect: {
                                    id: data.attachmentId
                                }
                            }
                        }
                        : {})
                },
                include: { category: true, attachment: true }
            }
        )
    }

    async delete(id: number): Promise<Subcategory> {
        const deletionData = {
            deleted: true,
            active: false,
        }
        return (await Promise.all([
            this.prismaSubcategory.update(
                {
                    where: { id },
                    data: deletionData
                }
            ),
            prisma.service.updateMany({
                where: {
                    subcategoryId: id,
                },
                data: deletionData
            })
        ]))[0]
    }


    async getAvailableServices(latitude: number, longitude: number, categoryId: number) {
        const locations = await prisma.location.findMany({
            where: {
                active: true
            },
            include: {
                geolocation: true
            }
        })

        const feasibleLocations = locations.filter((location: { geolocation: { latitude: number; longitude: number; }; radius: number; }) => isWithinRadius(
            location.geolocation.latitude,
            location.geolocation.longitude,
            latitude,
            longitude,
            location.radius
        ))

        const feasibleSubcategoryLocations = (await Promise.all(
            feasibleLocations.map(async (location: { id: any; }) =>
                await prisma.subcategoryLocation.findMany({
                    where: {
                        locationId: location.id,
                        subcategory: {
                            categoryId
                        },
                        active: true
                    },
                    include: {
                        subcategory: {
                            select: {
                                name: true
                            }
                        }
                    }
                })
            ))).flat()

        const serviceTaskFilteredLocations = (await Promise.all(
            feasibleSubcategoryLocations.map((location: { locationId: any; subcategoryId: any; }) =>
                prisma.taskLocation.findMany({
                    where: {
                        locationId: location.locationId,
                        service: {
                            subcategoryId: location.subcategoryId,
                            active: true,
                        },
                        active: true
                    },
                    select: {
                        service: {
                            include: {
                                slots: true,
                                tasks: true
                            }
                        }
                    }
                })
            ))).flat()

        return serviceTaskFilteredLocations
            .filter((service: { service: { slots: string | any[]; }; }) => service.service.slots.length)
            .map((service: { service: any; }) => {
                const resultantService = service.service
                resultantService.slots = resultantService.slots
                    .filter((slot: { date: moment.MomentInput; }) => moment(slot.date).diff(moment.now(), "days") >= resultantService.bookBeforeInDays)
                return resultantService
            })
    }
}

export default SubcategoryModel