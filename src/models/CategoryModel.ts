import { GlobalSearchParams } from './UserModel';
import { Category, PrismaClient, } from "@prisma/client";
import { SortEnum } from '../shared/enum/sort-enum';
import { PAGE_LIMIT } from '../shared/constants/paginationMeta';
import { OfferTypeEnum } from '../shared/enum/offer-type-enum';
import { prisma } from '../..';

type CategoryLocationCreateManyInput = {
    categoryId: number
    locationId: number
    cost?: number
    active?: boolean
}

export type OfferParams = {
    discount: number
    offerType: OfferTypeEnum
    maximumDiscount?: number | null
    validTill?: Date | null
    minimumOrder?: number | null
}
export type OfferUpdateParams = {
    id?: number
    discount?: number
    offerType?: OfferTypeEnum
    maximumDiscount?: number
    validTill?: Date
    minimumOrder?: number
}

type CategoryParams = {
    name: string
    description: string
    attachmentId: number
    bannerId: number
}

type CategoryUpdateParams = {
    id?: number
    name?: string
    description?: string
    active?: boolean
    attachmentId?: number
    bannerId?: number
}

export type LocationAvailablityUpdateParams = {
    locationId: number
    active: boolean
}

type OrderKeys = "name" | "active"

type FilterKeys = {
    search?: string
    active?: boolean
}

interface SearchParams extends GlobalSearchParams {
    orderBy?: Record<OrderKeys, SortEnum>
    filterBy?: FilterKeys
}

interface CategoriesListResponse {
    categories: Array<Category | any>,
    // categories: Array<Category>,
    meta: SearchParams
}

class CategoryModel {

    constructor(
        private readonly prismaCategory: PrismaClient['category'],
    ) { }

    async index(params?: SearchParams): Promise<CategoriesListResponse> {

        const take = params?.limit || PAGE_LIMIT;
        const skip = ((params?.page || 1) - 1) * take;

        const where = {
            deleted: false
            // active: true,
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

        const [categories, totalCount] = await Promise.all([this.prismaCategory.findMany({
            take,
            skip,
            where,
            orderBy: params?.orderBy || { createdAt: "desc" },
            include: {
                attachment: true,
                banner: true,
                _count: {
                    select: {
                        subcategories: true,
                        services: true,
                        bookings: true,
                    },
                },
            }
        }),

        this.prismaCategory.count({ where }),
        ])

        const meta: SearchParams = {
            page: 1,
            limit: PAGE_LIMIT,
            ...params,
            totalCount,
        }

        return { categories, meta }
    }

    async show(categoryId: number) {
        return await this.prismaCategory.findUnique({
            where: { id: categoryId },
            include: {
                categoryLocations: true,
                attachment: true,
                banner: true,
                _count: {
                    select: {
                        bookings: true,
                        subcategories: true,
                        services: true
                    }
                }
            }
        })
    }

    async meta() {
        return await this.prismaCategory.findMany({ where: { deleted: false }, select: { id: true, name: true } })
    }

    async locationsIndex(categoryId: number) {
        return await prisma.categoryLocation.findMany({
            where: {
                categoryId, location: {
                    deleted: false
                }
            },
            // include: { location: true },
            orderBy: { location: { name: "asc" } },
            select: {
                active: true, location: true, locationId: true,
            }
        })
    }

    async locationsUpdate(categoryId: number, locations: LocationAvailablityUpdateParams[]) {
        for (const data of locations) {
            const locationPromise = prisma.categoryLocation.updateMany({
                where: {
                    categoryId,
                    locationId: data.locationId,
                },
                data: {
                    active: data.active,
                },
            })
            await locationPromise;
        }

        return await prisma.categoryLocation.findMany({
            where: { categoryId },
            // include: { location: true },
            orderBy: { location: { name: "asc" } },
            select: {
                active: true, location: true, locationId: true
            }
        })
    }

    async create(data: CategoryParams): Promise<Category | null> {

        const category = await this.prismaCategory.create({
            data: {
                name: data.name,
                description: data.description,
                attachment: {
                    connect: {
                        id: data.attachmentId
                    }
                },
                banner: {
                    connect: {
                        id: data.bannerId
                    }
                }
            }
        })

        const locations = await prisma.location.findMany({ select: { id: true } })

        const categoryLocations: Array<CategoryLocationCreateManyInput> = []

        for (const location of locations) {

            categoryLocations.push({
                locationId: location.id,
                categoryId: category.id,
            })
        }

        await prisma.categoryLocation.createMany({ data: categoryLocations })

        return await this.prismaCategory.findUnique({
            where: {
                id: category.id,
            },
            include: {
                categoryLocations: true,
                attachment: true,
                banner: true,
            }
        })
    }

    async update(id: number, data: CategoryUpdateParams): Promise<Category> {

        return await this.prismaCategory.update(
            {
                where: { id },
                data: {
                    name: data.name,
                    description: data.description,
                    active: data.active,
                    ...(data.attachmentId
                        ? {
                            attachment: {
                                connect: {
                                    id: data.attachmentId
                                }
                            }
                        }
                        : {}),
                    ...(data.bannerId
                        ? {
                            banner: {
                                connect: {
                                    id: data.bannerId
                                }
                            }
                        }
                        : {})
                },
                include: {
                    categoryLocations: true,
                    attachment: true,
                    banner: true,
                }
            }
        )
    }

    async delete(id: number): Promise<Category> {
        const deletionData = {
            deleted: true,
            active: false,
        }

        return (await Promise.all([
            this.prismaCategory.update(
                {
                    where: { id },
                    data: deletionData
                }
            ),
            prisma.subcategory.updateMany(
                {
                    where: {
                        categoryId: id
                    },
                    data: deletionData
                }
            ),
            prisma.subcategory.updateMany(
                {
                    where: {
                        categoryId: id
                    },
                    data: deletionData
                }
            ),
        ]))[0]
    }
}

export default CategoryModel