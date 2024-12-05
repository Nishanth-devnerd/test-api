import { Attachment, AttachmentTypes, Service, Task, WarrantyPeriodType } from "@prisma/client";
import { prisma } from "../..";
import { OfferParams, OfferUpdateParams } from "./CategoryModel";
import { ErrorModel } from "./ErrorModel";
import { GlobalSearchParams } from "./UserModel";
import { SortEnum } from "../shared/enum/sort-enum";
import { PAGE_LIMIT } from "../shared/constants/paginationMeta";
import moment from "moment";
import { isWithinRadius } from "../shared/utils/calculateDistance";
import LocationModel from "./LocationModel";
import { isInServiceableRegion } from "../shared/utils/isInServiceableRegion";

interface LocationSpecificServicesOptions {
    categoryId?: number
    subcategoryId?: number
}

export interface FaqParams {
    title: string,
    description: string
}

export interface TaskParams {
    name: string,
    duration: number,
    baseCost: number
}

export interface FaqUpdateParams {
    id: number
    title?: string,
    description?: string
}

export interface TaskUpdateParams {
    id: number
    name?: string,
    duration?: number,
    baseCost?: number
}

export interface ServiceParams {
    categoryId: number,
    subcategoryId: number,
    name: string,
    description: string
    activeFrom: Date,
    activeTill?: Date,
    bookBeforeInDays: number,
    guarentee: string,
    disclaimer: string,
    warrantyPeriod: number,
    isAvailableEverywhere?: boolean,
    warrantyPeriodType: WarrantyPeriodType,
    baseOffer: OfferParams,
    inspectionTask: TaskParams
}

export interface ServiceUpdateParams {
    id?: number
    categoryId?: number,
    subcategoryId?: number,
    name?: string,
    description?: string
    activeFrom?: Date,
    active?: boolean,
    activeTill?: Date,
    bookBeforeInDays?: number,
    guarentee?: string,
    disclaimer?: string,
    warrantyPeriod?: number,
    warrantyPeriodType?: WarrantyPeriodType,
    baseOffer?: OfferUpdateParams
    slotStartAt?: Date,
    slotEndAt?: Date,
    slotDuration?: number,
    inspectionTask?: TaskUpdateParams,
    faqs?: Array<FaqUpdateParams>,
    tasks?: Array<TaskUpdateParams>
}

type FilterKeys = {
    search?: string
    active?: boolean
    categoryIds: Array<string>
    subcategoryIds: Array<string>
}

interface ServiceListResponse {
    services: Array<Service>,
    meta: SearchParams
}
type OrderKeys = "name" | "active" | "categoryName" | "subcategoryName"

interface SearchParams extends GlobalSearchParams {
    orderBy?: Record<OrderKeys, SortEnum>
    filterBy?: FilterKeys
}

class ServiceModel {
    private prismaService;
    private prismaAttachment;

    constructor() {
        this.prismaService = prisma.service;
        this.prismaAttachment = prisma.attachment;
    }

    async index(params?: SearchParams): Promise<ServiceListResponse> {

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

        if (params?.orderBy?.categoryName)
            params = {
                orderBy: { category: { name: params.orderBy.categoryName } } as any
            }

        if (params?.orderBy?.subcategoryName)
            params = {
                orderBy: { subcategory: { name: params.orderBy.subcategoryName } } as any
            }

        const services = await this.prismaService.findMany({
            ...(!params?.export ? { take, skip } : {}),
            where,
            orderBy: params?.orderBy || { createdAt: "desc" },
            include: {
                category: true,
                subcategory: true,
                attachments: true,
                baseOffer: true,
                inspectionTask: true,
                faqs: true,
                tasks: {
                    include: {
                        taskLocations: {
                            include: {
                                location: true,
                                offer: true
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        bookings: true,
                    }
                },
            },
        })

        const totalCount = await this.prismaService.count({ where })

        const meta: SearchParams = {
            page: 1,
            limit: PAGE_LIMIT,
            ...params,
            totalCount,
        }
        return { services, meta }
    }

    async meta() {
        return await this.prismaService.findMany({ where: { deleted: false }, select: { id: true, name: true } })
    }

    async show(serviceId: number, isCustomerShow?: boolean) {
        return await this.prismaService.findUnique({
            where: { id: serviceId },
            include: {
                taskLocations: true,
                baseOffer: true,
                tasks: {
                    include: {
                        taskLocations: {
                            where: {
                                active: true
                            },
                            select: {
                                location: {
                                    select: {
                                        name: true
                                    }
                                }
                            }
                        }
                    }
                },
                faqs: true,
                videoAttachments: true,
                attachments: true,
                slots: {
                    where: {
                        isNonBookable: false,
                        date: {
                            gte: new Date()
                        }
                    },
                    orderBy: {
                        date: "asc"
                    }
                },
                subcategory: {
                    select: {
                        name: true,
                        id: true
                    }
                },
                category: {
                    select: {
                        name: true,
                        id: true
                    }
                },
                ...(isCustomerShow
                    ? {
                        reviews: {
                            where: {
                                status: "approved"
                            },
                            include: {
                                user: {
                                    select: {
                                        name: true
                                    }
                                }
                            },
                            orderBy: {
                                rating: "desc",
                            }
                        }
                    }
                    : {
                        reviews: {
                            include: {
                                user: {
                                    select: {
                                        name: true
                                    }
                                }
                            }
                        }
                    }),
                inspectionTask: true,
                _count: {
                    select: {
                        bookings: true
                    }
                }
            }
        })
    }

    async create(data: ServiceParams): Promise<Service> {
        const service = await this.prismaService.create({
            data: {
                name: data.name,
                description: data.description,
                activeFrom: data.activeFrom,
                activeTill: data.activeTill,
                bookBeforeInDays: data.bookBeforeInDays,
                guarentee: data.guarentee,
                warrantyPeriod: data.warrantyPeriod,
                warrantyPeriodType: data.warrantyPeriodType,
                disclaimer: data.disclaimer,
                isAvailableEverywhere: data.isAvailableEverywhere,
                active: true,
                category: {
                    connect: {
                        id: data.categoryId
                    }
                },
                subcategory: {
                    connect: {
                        id: data.subcategoryId
                    }
                },
                baseOffer: {
                    create: {
                        discount: data.baseOffer.discount,
                        offerType: data.baseOffer.offerType,
                        minimumOrder: data.baseOffer.minimumOrder,
                        maximumDiscount: data.baseOffer.maximumDiscount,
                    }
                }
            }
        })
        const updatedService = this.prismaService.update({
            where: {
                id: service.id
            },
            data: {
                inspectionTask: {
                    create: {
                        ...data.inspectionTask,
                        inspectionServiceId: service.id,
                    }
                }
            },
            include: {
                baseOffer: true,
                inspectionTask: true
            }
        })

        return updatedService
    }

    async update(id: number, data: ServiceUpdateParams): Promise<Service | void> {

        const service = await this.prismaService.findUnique({ where: { id }, include: { baseOffer: true, tasks: true, faqs: true } })

        if (!service) throw new ErrorModel({ statusCode: 422, name: "No service with id", message: "Service not found" })

        if (service?.baseOffer?.id)
            await prisma.offer.update({
                where: {
                    id: service?.baseOfferId,
                },
                data: {
                    offerType: data.baseOffer?.offerType,
                    discount: data.baseOffer?.discount,
                    minimumOrder: data.baseOffer?.minimumOrder,
                    maximumDiscount: data.baseOffer?.maximumDiscount,
                }
            })

        if (data.inspectionTask?.id)
            await prisma.task.update({
                data: {
                    ...data.inspectionTask,
                },
                where: {
                    id: data.inspectionTask.id,
                }
            })

        if (moment(service.activeFrom).format("DD/MM/YYYY") !== moment(data.activeFrom).format("DD/MM/YYYY")
            || moment(service.activeTill).format("DD/MM/YYYY") !== moment(data.activeTill).format("DD/MM/YYYY")) {
            await Promise.all([
                prisma.slot.deleteMany({
                    where: {
                        serviceId: id,
                        bookings: {
                            none: {}
                        }
                    }
                }),
                prisma.slot.updateMany({
                    where: {
                        serviceId: id,
                        bookings: {
                            some: {}
                        }
                    },
                    data: {
                        isNonBookable: true
                    }
                })
            ])
        }

        const test = {
            name: data.name,
            description: data.description,
            activeFrom: data.activeFrom,
            activeTill: data.activeTill,
            bookBeforeInDays: data.bookBeforeInDays,
            guarentee: data.guarentee,
            warrantyPeriod: data.warrantyPeriod,
            warrantyPeriodType: data.warrantyPeriodType,
            disclaimer: data.disclaimer,
            active: data.active,
            slotDuration: data.slotDuration,
            slotStartAt: data.slotStartAt,
            slotEndAt: data.slotEndAt,
            // categoryId: {
            //     set: data.categoryId
            // },
            ...(data.categoryId
                ? {
                    subcategory: {
                        connect: {
                            id: data.categoryId
                        }
                    }
                }
                : {}),
            ...(data.subcategoryId
                ? {
                    subcategory: {
                        connect: {
                            id: data.subcategoryId
                        }
                    }
                }
                : {})
        }

        const updatedService = await this.prismaService.update({
            where: { id },
            data: test,
            include: {
                faqs: true, tasks: true, inspectionTask: true,
                slots: {
                    where: {
                        isNonBookable: false
                    }
                },
                baseOffer: true, attachments: true, videoAttachments: true,
            }
        })
        return updatedService
    }

    async addAttachment(id: number, attachmentId: number) {

        const [currentService, attachment] = await Promise.all([
            this.prismaService.findUnique({ where: { id }, select: { id: true } }),
            this.prismaAttachment.findUnique({ where: { id: attachmentId }, select: { type: true } })
        ])

        if (!currentService?.id) throw new ErrorModel({ statusCode: 422, name: "No service with id", message: "Service not found" })

        const service = await this.prismaService.update({
            where: { id },
            data: {
                [attachment?.type === AttachmentTypes.service_image
                    ? "attachments"
                    : "videoAttachments"]: {
                    connect: {
                        id: attachmentId
                    }
                }
            },
            select: {
                attachments: true,
                videoAttachments: true
            }
        })

        return service
    }

    async delete(id: number): Promise<void> {
        await this.prismaService.update({
            where: { id }, data: {
                deleted: true,
                active: false,
            }
        })
        return;
    }

    async showIfAvailable(latitude: number, longitude: number, serviceId: number, customerId?: number): Promise<any> {
        const [locations, service] = await Promise.all([
            prisma.location.findMany({
                where: {
                    active: true
                },
                include: {
                    geolocation: true
                }
            }),
            this.prismaService.findUnique({ where: { id: serviceId } })
        ])

        if (service?.isAvailableEverywhere && await isInServiceableRegion(latitude, longitude))
            return { service: await this.show(serviceId, true) }

        // TODO: find everything, not only one
        const anyFeasibleLocations = locations.filter(location => isWithinRadius(
            location.geolocation.latitude,
            location.geolocation.longitude,
            latitude,
            longitude,
            location.radius
        ))

        // if (!anyFeasibleLocation)
        //     throw new ErrorModel({ statusCode: 400, message: "Service not available for specified location", name: "Service unavailable" })

        const servicesData = await Promise.all(anyFeasibleLocations.map(anyFeasibleLocation => prisma.taskLocation.findMany({
            where: {
                locationId: anyFeasibleLocation?.id,
                service: {
                    id: serviceId,
                    active: true,
                },
                active: true
            },
            select: {
                active: true,
                service: {
                    include: {
                        faqs: true,
                        attachments: true,
                        inspectionTask: true,
                        videoAttachments: true,
                        // slots: {
                        //     where: {
                        //         active: true
                        //     }
                        // },
                        category: {
                            select: {
                                name: true
                            }
                        },
                        subcategory: {
                            select: {
                                name: true
                            }
                        },
                        reviews: {
                            where: {
                                status: "approved"
                            },
                            include: {
                                user: {
                                    select: {
                                        name: true
                                    }
                                }
                            },
                            orderBy: {
                                rating: "desc",
                            }
                        },
                        tasks: true,
                        slots: true,
                        // tasks: true,
                        baseOffer: true,
                        _count: {
                            select: {
                                reviews: {
                                    where: {
                                        status: "approved",
                                        userId: customerId
                                    }
                                },
                                bookings: {
                                    where: {
                                        customerId
                                    }
                                }
                            }
                        }
                    },
                },
                offer: true,
            }
        })))

        const serviceData = servicesData.flat()[0]
        // if ((!anyFeasibleLocation || !serviceData?.active) && serviceData)
        //     serviceData.service.active = false
        return serviceData
    }

    async getAvailableServices(latitude: number, longitude: number, options?: LocationSpecificServicesOptions) {

        const [feasibleLocations, availableEverywhereServices] = await Promise.all([
            new LocationModel(prisma.location).getFeasibleLocations(latitude, longitude),
            this.prismaService.findMany({
                where: {
                    isAvailableEverywhere: true,
                    deleted: false,
                    active: true,
                    subcategory: {
                        active: true
                    },
                    category: {
                        active: true
                    },
                    slots: {
                        some: {
                            active: true
                        }
                    },
                }, include: {
                    slots: {
                        where: {
                            active: true
                        }
                    },
                    tasks: true,
                    baseOffer: true,
                    attachments: true,
                    inspectionTask: true,
                    reviews: {
                        where: {
                            status: "approved"
                        },
                        select: {
                            id: true
                        }
                    }
                }
            })
        ])

        const feasibleCategoryLocations = (await Promise.all(feasibleLocations.map(location =>
            prisma.categoryLocation.findMany({
                where: {
                    locationId: location.id,
                    active: true,
                    category: {
                        active: true,
                    }
                },
                select: {
                    locationId: true,
                    categoryId: true
                }
            })
        ))).flat()

        const feasibleSubcategoryLocations = (await Promise.all(
            feasibleCategoryLocations.map(async location =>
                await prisma.subcategoryLocation.findMany({
                    where: {
                        locationId: location.locationId,
                        subcategory: {
                            categoryId: location.categoryId,
                            active: true,
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
            feasibleSubcategoryLocations.map(location =>
                prisma.taskLocation.findMany({
                    where: {
                        locationId: location.locationId,
                        service: {
                            categoryId: options?.categoryId,
                            subcategoryId: location.subcategoryId,
                            active: true,
                        },
                        active: true
                    },
                    select: {
                        service: {
                            include: {
                                slots: {
                                    where: {
                                        active: true
                                    }
                                },
                                tasks: true,
                                baseOffer: true,
                                attachments: true,
                                inspectionTask: true,
                                reviews: {
                                    where: {
                                        status: "approved"
                                    },
                                    select: {
                                        id: true
                                    }
                                }
                            }
                        }
                    }
                })
            ))).flat()


        const today = new Date();
        const isAvailableEverywhere = await isInServiceableRegion(latitude, longitude)
        const finalAvailableServices = [...serviceTaskFilteredLocations
            .filter(service => {
                const afterAvailablity = new Date(today);
                afterAvailablity.setDate(today.getDate() + service.service.bookBeforeInDays)
                service.service.slots = service.service.slots.filter(slot => new Date(slot.date) >= afterAvailablity)
                return service.service.slots.length &&
                    (!options?.subcategoryId || service.service.subcategoryId === options.subcategoryId)
            })
            .map(service => {
                const resultantService = service.service
                resultantService.slots = resultantService.slots
                    .filter(slot => moment(slot.date).diff(moment.now(), "days") >= resultantService.bookBeforeInDays)
                return resultantService
            }),
        ...(isAvailableEverywhere ? availableEverywhereServices : [])
        ]
        const uniqueServiceIds = Array.from(new Set(finalAvailableServices.map(service => service.id)))

        const uniqueServices = uniqueServiceIds.map(serviceId => finalAvailableServices.find(service => service.id === serviceId))

        return uniqueServices.filter(service => !!service?.id) as Service[]
    }

    async isReviewbleByUser(serviceId: number, userId?: number) {
        return userId && !!await prisma.service.findFirst({
            where: {
                id: serviceId,
                active: true,
                OR: [
                    {
                        reviews: {
                            some: {
                                AND: [
                                    { userId: userId, },
                                    { status: "rejected" }
                                ],
                            }
                        }
                    },
                    { reviews: { none: {} } }
                ],
                bookings: {
                    some: {
                        customerId: userId
                    }
                }
            }
        })
    }
}

export default ServiceModel