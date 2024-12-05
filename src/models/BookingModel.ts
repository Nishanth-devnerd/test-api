import { toTitleCase } from './../shared/utils/toTitleCase';
import { Booking, BookingStatus, Employee, PaymentGatewayProvider, PaymentModes, PaymentTypes, Prisma, TaxEnum, WarrantyStatus } from "@prisma/client";
import { DefaultArgs } from "@prisma/client/runtime/library";
import axios from "axios";
import moment from "moment";
import { prisma } from "../..";
import { getHeaders, PhonePePaymentCode } from "../controllers/PaymentController/PaymentController";
import TransactionService from "../services/transaction";
import BookingStatusMap from "../shared/constants/BookingStatusMap";
import { PAGE_LIMIT } from "../shared/constants/paginationMeta";
import { calculateTotalCost, calculateTotalCostAfterTax } from "../shared/utils/calculateTotalCost";
import { checkIfCouponApplicable } from "../shared/utils/checkIfCouponApplicable";
import { checkLocationFeasibility } from "../shared/utils/checkLocationFeasibility";
import { isInServiceableRegion } from "../shared/utils/isInServiceableRegion";
import { ErrorModel } from "./ErrorModel";
import { GlobalSearchParams } from "./UserModel";
import logger from '../shared/utils/logger';
import sha256 from 'sha256';

export const paymentAxiosInstance = axios.create();

paymentAxiosInstance.interceptors.request.use(function (config) {
    config.headers = getHeaders();
    return config;
});

type BookingActions = "created" | "status_changed" | "assigned" | "warranty_requested"

type FilterKeys = {
    customerId?: number
    search?: string
    status?: BookingStatus[]
}

interface SearchParams extends GlobalSearchParams {
    // orderBy?: Record<OrderKeys, SortEnum>
    filterBy?: FilterKeys
}

interface BookingsListResponse {
    bookings: Array<Booking>,
    meta: SearchParams
}


type BookingParams = {
    customerId: number
    addressId: number
    couponId?: number
    isOnlinePayment?: boolean
    serviceId: number
    taskId: number
    slotId: number
    status?: BookingStatus
}

type BookingUpdateParams = {
    isOnlinePayment?: boolean
}

type AttachmentIds = {
    id: number;
}
type WarrantyParams = {
    reason: string
    description?: string
    attachments: AttachmentIds[]
}

export default class BookingModel {
    prismaBooking;
    includes: Prisma.BookingInclude<DefaultArgs>;

    constructor() {
        this.prismaBooking = prisma.booking;

        this.includes = {
            address: {
                include: {
                    geolocation: true
                }
            },
            customer: true,
            appliedOffer: true,
            appliedCoupon: {
                include: {
                    offer: true
                }
            },
            category: true,
            service: {
                include: {
                    baseOffer: true,
                    inspectionTask: true,
                    attachments: true
                }
            },
            subcategory: true,
            invoice: true,
            slot: true,
            task: true,
            transactions: {
                orderBy: {
                    createdAt: "desc"
                }
            },
            warranty: {
                include: {
                    attachments: true
                }
            },
            employee: true,
            bookingTaxes: true,
            mappedLocation: true,
            warrantyEmployee: true,
        }
    }


    async index(params?: SearchParams, customerId?: number): Promise<BookingsListResponse> {
        const take = params?.limit || PAGE_LIMIT;
        const skip = ((params?.page || 1) - 1) * take;

        const where: Prisma.BookingWhereInput = {
            deleted: false
            // active: true,
        };

        if (customerId)
            Object.assign(where, {
                AND: [
                    { customerId },
                ],
                NOT: [
                    { status: { equals: BookingStatus.deleted_by_user } },
                    { status: { equals: BookingStatus.initiated } },
                ]
            });

        if (params?.filterBy?.search)
            Object.assign(where, {
                OR: [
                    { customer: { name: { contains: params.filterBy?.search, mode: 'insensitive' } } },
                    { mappedLocation: { name: { contains: params.filterBy?.search, mode: 'insensitive' } } },
                    (!isNaN(+(params.filterBy?.search || 0)) ? { uid: { equals: +(params.filterBy?.search || 0) } } : {})
                ]
            });

        if (params?.filterBy?.status?.length)
            Object.assign(where, {
                OR: [
                    ...params.filterBy.status.map(status => ({ status: { equals: status } })),
                ],
            });

        if (params?.filterBy?.customerId)
            Object.assign(where, {
                customerId: params?.filterBy?.customerId
            });

        const bookings = await this.prismaBooking.findMany({
            take,
            skip,
            where,
            orderBy: { createdAt: "desc" },
            include: {
                customer: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                service: true,
                slot: true,
                mappedLocation: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                logs: {
                    orderBy: {
                        createdAt: 'desc',
                    },
                    take: 1,
                }
            }
        })
        const totalCount = await this.prismaBooking.count({ where })

        const meta: SearchParams = {
            page: 1,
            limit: PAGE_LIMIT,
            ...params,
            totalCount,

        }
        return { bookings, meta }
    }

    async show(id: number, customerId?: number) {

        const where = {
            id,
            deleted: false
        }

        // if (customerId) {
        //     Object.assign(where, {
        //         customerId
        //     });
        // }

        const booking = await this.prismaBooking.findFirst({
            where,
            include: this.includes
        })

        if (customerId && booking?.customerId !== customerId)
            throw new ErrorModel({ code: 403, message: "Unauthorized access", name: "Unauthorized access" })

        if (!booking?.taskId || !booking?.mappedLocationId)
            return booking

        const actualTaskLocation = await prisma.taskLocation.findUnique({
            where: {
                taskId_locationId: {
                    taskId: booking?.taskId,
                    locationId: booking?.mappedLocationId
                }
            }
        })

        return {
            ...booking,
            task: {
                ...booking.task,
                baseCost: actualTaskLocation?.cost
            }
        }
    }

    async create(data: BookingParams, getQuotation?: boolean) {
        const service = await prisma.service.findUnique({
            where: { id: data.serviceId },
            include: { tasks: true, baseOffer: true, slots: true, inspectionTask: true, subcategory: true, category: true }
        })

        const inspectionBooking = service?.inspectionTaskId === data.taskId

        const task = inspectionBooking ? service.inspectionTask : service?.tasks.find((task: { id: number; }) => task.id === data.taskId)

        const slot = service?.slots.find((slot: { id: number; }) => slot.id === data.slotId)

        if (!service ||
            !service.active ||
            !service.subcategory.active ||
            !service.category.active) throw new ErrorModel({
                code: 422,
                message: "Invalid service",
                name: "Invalid data - Invalid service"
            })

        if (!task || !slot || !slot.active)
            throw new ErrorModel({
                code: 422,
                message: "Invalid task or slot",
                name: "Invalid data - Invalid task or slot"
            })

        if (moment(slot.date).diff(moment.now(), "days") < service.bookBeforeInDays)
            throw new ErrorModel({
                code: 422,
                message: "Slot unavailable",
                name: "Invalid data - Slot unavailable"
            })

        const feasibleLocation = await checkLocationFeasibility(data.addressId, {
            serviceId: data.serviceId,
            taskId: service?.inspectionTaskId === data.taskId ? undefined : data.taskId,
            categoryId: service.categoryId,
            subcategoryId: service.subcategoryId,
        })

        // const address = await prisma.address.findUnique({
        //     where: { id: data.addressId },
        //     include: { geolocation: true }
        // })

        const address = await prisma.address.findUnique({
            where: { id: data.addressId },
            include: { geolocation: true }
        })

        if (!feasibleLocation) {
            if (!service?.isAvailableEverywhere || !(address?.geolocation.latitude &&
                address?.geolocation.longitude &&
                await isInServiceableRegion(address?.geolocation.latitude, address?.geolocation.longitude))
            ) throw new ErrorModel({
                code: 422,
                message: `We're sorry, but ${service.name || "this service"} isn't available in your area right now. We're actively working to make it accessible to you as soon as we can. Thank you for your understanding and patience.`,
                name: "Invalid data - Location unavailable"
            })
        }

        // const [category, subcategory] = await Promise.all([
        //     prisma.categoryLocation.findUnique({
        //         where: {
        //             categoryId_locationId: { categoryId: service.categoryId, locationId: feasibleLocation.locationId }
        //         },
        //         select: { offer: true }
        //     }),
        //     prisma.subcategoryLocation.findUnique({
        //         where: {
        //             subcategoryId_locationId: { subcategoryId: service.subcategoryId, locationId: feasibleLocation.locationId }
        //         },
        //         select: { offer: true }
        //     }),
        // ])

        const isInsideTamilNadu = await this.#isInsideTamilNadu(data.addressId);

        // const availableOffers: [number, string | null, number][] = [
        //     calculateTotalCost(inspectionBooking ? service.inspectionTask?.baseCost || 0 : feasibleLocation.cost, feasibleLocation.offer),
        //     calculateTotalCost(inspectionBooking ? service.inspectionTask?.baseCost || 0 : feasibleLocation.cost, service.baseOffer)
        // ]

        const coupon = data.couponId
            ? await prisma.coupon.findUnique({ where: { id: data.couponId }, include: { offer: true } })
            : null

        // if (category?.offer)
        //     availableOffers.push(calculateTotalCost(inspectionBooking ? service.inspectionTask?.baseCost || 0 : feasibleLocation.cost, category?.offer))
        // if (subcategory?.offer)
        //     availableOffers.push(calculateTotalCost(inspectionBooking ? service.inspectionTask?.baseCost || 0 : feasibleLocation.cost, subcategory?.offer))

        // const bestOffer = availableOffers.sort((offer1, offer2) => (offer1[0] || 0) - (offer2[0] || 0)).at(0)

        const [taskCost, taskOffer] = feasibleLocation && !service.isAvailableEverywhere
            ? [feasibleLocation.cost, feasibleLocation.offer]
            : [task.baseCost, service.baseOffer]

        const bestOffer = calculateTotalCost(inspectionBooking
            ? service.inspectionTask?.baseCost || 0 : taskCost, taskOffer)

        const bestOfferData = bestOffer?.[1] ? await prisma.offer.findUnique({ where: { id: bestOffer?.[1] } }) : null


        const totalCostAfterOfferApplied = bestOffer?.[0] ||
            calculateTotalCost(inspectionBooking ? service.inspectionTask?.baseCost || 0 : taskCost, bestOfferData)[0]

        const couponDiscountData = calculateTotalCost(totalCostAfterOfferApplied, coupon?.offer)

        const taxes = await prisma.taxation.findMany({
            where: {
                // OR: [{ taxName: TaxEnum.common }]
                OR: [
                    ...(isInsideTamilNadu
                        ? [{ taxName: TaxEnum.cgst }, { taxName: TaxEnum.sgst }]
                        : [{ taxName: TaxEnum.igst }])
                ]
            }
        })

        const [totalTax, bookingTaxes] = calculateTotalCostAfterTax(couponDiscountData[0], taxes)

        const bookingAddress = await prisma.bookingAddress.create({
            data: {
                addressType: address?.addressType || "",
                landmark: address?.landmark,
                userId: data.customerId,
                geolocation: {
                    create: {
                        latitude: address?.geolocation?.latitude || 0,
                        longitude: address?.geolocation?.longitude || 0,
                        city: address?.geolocation?.city || "",
                        state: address?.geolocation?.state || "",
                        pincode: address?.geolocation?.pincode || "",
                        addressLine: address?.geolocation?.addressLine || ""
                    }
                }
            }
        })

        const booking: any = getQuotation
            ? {
                appliedOffer: bestOfferData,
                appliedOfferId: bestOffer?.[1],
                totalWithoutTax: couponDiscountData[0],
                totalTax,
                total: couponDiscountData[0] + totalTax,
                subTotal: inspectionBooking ? service.inspectionTask?.baseCost || 0 : taskCost,
                appliedCouponId: coupon?.id,
                offerDiscount: bestOffer?.[2] || calculateTotalCost(inspectionBooking ? service.inspectionTask?.baseCost || 0 : taskCost, bestOfferData)[2],
                couponDiscount: couponDiscountData[2],
                bookingTaxes
            }
            : await this.prismaBooking.create({
                data: {
                    customerId: data.customerId,
                    addressId: bookingAddress.id,
                    serviceId: data.serviceId,
                    taskId: data.taskId,
                    slotId: data.slotId,
                    status: data.status,
                    isOnlinePayment: data.isOnlinePayment,
                    appliedCouponId: coupon?.id,
                    offerDiscount: bestOffer?.[2] || calculateTotalCost(inspectionBooking ? service.inspectionTask?.baseCost || 0 : taskCost, bestOfferData)[2],
                    couponDiscount: couponDiscountData[2],
                    categoryId: service.categoryId,
                    subcategoryId: service.subcategoryId,
                    mappedLocationId: feasibleLocation?.locationId,
                    appliedOfferId: bestOffer?.[1],
                    totalWithoutTax: couponDiscountData[0],
                    totalTax,
                    total: couponDiscountData[0] + totalTax,
                    subTotal: inspectionBooking ? service.inspectionTask?.baseCost || 0 : taskCost,
                    bookingTaxes: {
                        create: bookingTaxes
                    }
                },
                include: this.includes
            })

        return {
            ...booking,
            ...(!inspectionBooking && booking?.task && {
                task: {
                    ...booking?.task,
                    baseCost: (service.isAvailableEverywhere ? taskCost : feasibleLocation?.cost) || 0
                }
            })
        }
    }

    async statusUpdate(bookingId: number, status: BookingStatus, userId: number) {

        const booking = await this.prismaBooking.findUnique({ where: { id: bookingId } })

        if (!booking?.status || !this.#validStatusChange(booking?.status, status))
            throw new ErrorModel({
                code: 422,
                name: "Invalid status change",
                message: `Booking with ${booking?.status} can't be updated to ${status}`
            })

        await this.createLog(booking.id, userId, "status_changed", { status })

        const response = await this.prismaBooking.update({
            where: {
                id: bookingId,
            },
            data: {
                status
            },
            include: this.includes
        })

        if (!response.isOnlinePayment && response.status === BookingStatus.completed)
            await new TransactionService().createOfflineTransaction({
                bookingId,
                amount: booking.total,
                provider: PaymentGatewayProvider.offline,
                mode: PaymentModes.offline,
                type: "credited",
            })

        return response
    }


    async update(bookingId: number, data: BookingUpdateParams) {

        await this.prismaBooking.update({
            where: { id: bookingId },
            data: {
                isOnlinePayment: data.isOnlinePayment
            }
        })

    }

    async updateAddress(bookingId: number, addressId: number) {

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: this.includes
        })

        const service: any = booking?.service

        const task = booking?.task

        const inspectionBooking = service?.inspectionTaskId === task?.id

        if (!booking || !service?.categoryId || !service?.subcategoryId || !task?.id) return false

        const feasibleLocation = await checkLocationFeasibility(addressId, {
            serviceId: booking.serviceId,
            taskId: booking.service?.inspectionTaskId === booking.taskId ? undefined : booking.taskId,
            categoryId: service.categoryId,
            subcategoryId: service.subcategoryId,
        })

        const address = await prisma.address.findUnique({
            where: { id: addressId },
            include: { geolocation: true }
        })
        if (!feasibleLocation) {
            if (!booking.service?.isAvailableEverywhere || !(address?.geolocation.latitude &&
                address?.geolocation.longitude &&
                await isInServiceableRegion(address?.geolocation.latitude, address?.geolocation.longitude))
            ) {
                return false
            }
        }

        const coupon: any = booking.appliedCoupon

        const [taskCost, taskOffer] = feasibleLocation && !service.isAvailableEverywhere
            ? [feasibleLocation.cost, feasibleLocation.offer]
            : [task.baseCost, service.baseOffer]

        const bestOffer = calculateTotalCost(inspectionBooking
            ? service.inspectionTask?.baseCost || 0 : taskCost, taskOffer)

        const bestOfferData = bestOffer?.[1] ? await prisma.offer.findUnique({ where: { id: bestOffer?.[1] } }) : null


        const totalCostAfterOfferApplied = bestOffer?.[0] ||
            calculateTotalCost(inspectionBooking ? service.inspectionTask?.baseCost || 0 : taskCost, bestOfferData)[0]

        const couponDiscountData = calculateTotalCost(totalCostAfterOfferApplied, coupon?.offer)
        await this.prismaBooking.update({
            where: { id: bookingId },
            data: { bookingTaxes: { deleteMany: {} } }
        })

        const isInsideTamilNadu = await this.#isInsideTamilNadu(booking.addressId);

        const taxes = await prisma.taxation.findMany({
            where: {
                OR: [
                    ...(isInsideTamilNadu
                        ? [{ taxName: TaxEnum.cgst }, { taxName: TaxEnum.sgst }]
                        : [{ taxName: TaxEnum.igst }])
                ]
            }
        })

        const [totalTax, bookingTaxes] = calculateTotalCostAfterTax(couponDiscountData[0], taxes)

        await prisma.bookingAddress.update({
            where: {
                id: booking.addressId
            },
            data: {
                addressType: address?.addressType || "",
                landmark: address?.landmark,
                geolocation: {
                    create: {
                        latitude: address?.geolocation?.latitude || 0,
                        longitude: address?.geolocation?.longitude || 0,
                        city: address?.geolocation?.city || "",
                        state: address?.geolocation?.state || "",
                        pincode: address?.geolocation?.pincode || "",
                        addressLine: address?.geolocation?.addressLine || ""
                    }
                }
            }
        })

        const updatedBooking = await this.prismaBooking.update({
            where: { id: bookingId },
            data: {
                appliedCouponId: coupon?.id,
                offerDiscount: bestOffer?.[2] || calculateTotalCost(inspectionBooking ? service.inspectionTask?.baseCost || 0 : taskCost, bestOfferData)[2],
                couponDiscount: couponDiscountData[2],
                mappedLocationId: feasibleLocation?.locationId,
                appliedOfferId: bestOffer?.[1],
                totalWithoutTax: couponDiscountData[0],
                totalTax,
                total: couponDiscountData[0] + totalTax,
                subTotal: inspectionBooking ? service.inspectionTask?.baseCost || 0 : taskCost,
                bookingTaxes: {
                    create: bookingTaxes
                }
            },
            include: this.includes
        })
        return {
            ...updatedBooking,
            ...(!inspectionBooking && updatedBooking?.task && {
                task: {
                    ...updatedBooking?.task,
                    baseCost: (service.isAvailableEverywhere ? taskCost : feasibleLocation?.cost) || 0
                }
            })
        }
    }

    async assignEmployee(id: number, employeeId: number) {
        const [employee, booking] = await Promise.all([
            prisma.employee.findUnique({ where: { id: employeeId } }),
            prisma.booking.findUnique({ where: { id } }),
        ])

        if (employee?.blocked || employee?.deleted)
            throw new ErrorModel({
                code: 422,
                message: "Invalid employee assign",
                name: "Unable to assign inacive employee"
            })

        let data = {
            employeeId,
            status: BookingStatus.approved
        } as any

        if (booking?.employeeId)
            data = {
                warrantyEmployeeId: employeeId
            }

        return this.prismaBooking.update({
            where: {
                id
            },
            data,
            include: {
                employee: true,
                customer: true,
                warrantyEmployee: true
            }
        })
    }

    async delete(bookingId: number): Promise<void> {

        await this.prismaBooking.update({
            where: {
                id: bookingId,
            },
            data: {
                deleted: true
            }
        })
    }

    async customerDelete(bookingId: number, customerId: number): Promise<void> {

        if (await this.prismaBooking.findFirst({ where: { customerId, id: bookingId } }))
            await this.prismaBooking.update({
                where: {
                    id: bookingId,
                },
                data: {
                    status: BookingStatus.deleted_by_user,
                    deleted: true
                }
            })
    }

    async fetchLogs(bookingId: number) {
        return await prisma.bookingLogs.findMany({
            where: {
                bookingId
            },
            include: {
                actionBy: true,
                employee: true
            },
            orderBy: { createdAt: "desc" }
        })

    }

    async createLog(bookingId: number, actionById: number, action: BookingActions, options?: {
        status?: BookingStatus,
        employee?: Employee
    }) {

        if (action === "status_changed" && !options?.status)
            throw new Error()

        if (action === "assigned" && !options?.employee?.id)
            throw new Error()

        await prisma.bookingLogs.create({
            data: {
                bookingId,
                actionById,
                employeeId: options?.employee?.id,
                action: action === "status_changed"
                    ? `${action.replaceAll("_", " ")} to ${options?.status}`
                    : action === "assigned"
                        ? `${action} to ${options?.employee?.name}`
                        : action
            }
        })

    }

    async applyCoupon(bookingId: number, couponId: number) {
        const [booking, coupon] = await Promise.all([
            this.prismaBooking.findUnique({ where: { id: bookingId }, include: { appliedCoupon: { include: { offer: true } } } }),
            prisma.coupon.findFirst({ where: { id: couponId }, include: { offer: true } })
        ])

        if (!booking?.id || !coupon?.id) throw new ErrorModel({
            code: 404,
            name: "No data found",
            message: (!booking?.id ? "Booking" : "Coupon") + " not found!!"
        })

        if (!coupon.active || coupon.offer.isExpired) throw new ErrorModel({
            code: 422,
            name: "Invalid data",
            message: "Coupon invalid!!"
        })

        if (!checkIfCouponApplicable(booking, coupon))
            throw new ErrorModel({
                code: 422,
                name: "Invalid request",
                message: "Coupon not applicable!!"
            })

        const couponDiscountData = calculateTotalCost(
            booking.total + booking.couponDiscount,
            coupon?.offer
        )

        return await this.prismaBooking.update({
            where: { id: bookingId },
            data: {
                total: couponDiscountData[0],
                appliedCouponId: couponId,
                couponDiscount: couponDiscountData[2],
            },
            include: {
                slot: true,
                task: true,
                service: true,
                appliedCoupon: {
                    include: {
                        offer: true
                    }
                },
                appliedOffer: true,
            }
        })
    }

    async raiseWarrantyRequest(bookingId: number, warrantyRequest: WarrantyParams) {

        if (!this.#warrantyRequestValidity(bookingId))
            throw new ErrorModel({
                code: 422,
                name: "Invalid request",
                message: "Warranty request invalid"
            })

        const warranty = await prisma.warranty.create({
            data: {
                bookingId,
                reason: warrantyRequest.reason,
                description: warrantyRequest.description,
                attachments: {
                    connect: warrantyRequest.attachments
                }
            }
        })
        return await this.prismaBooking.update({
            where: { id: bookingId },
            data: {
                warrantyId: warranty.id,
                status: BookingStatus.warranty_requested
            },
            include: this.includes
        })
    }

    async updateWarrantyRequest(bookingId: number, warrantyId: number, status: WarrantyStatus) {
        return await Promise.all([this.prismaBooking.update({
            where: { id: bookingId },
            data: {
                status: status === WarrantyStatus.approved
                    ? BookingStatus.warranty_request_accepted
                    : BookingStatus.warranty_request_rejected
            },
            include: {
                customer: true,
                warrantyEmployee: true,
                employee: true
            }
        }),
        prisma.warranty.update({
            where: {
                id: warrantyId,
            },
            data: {
                status
            }
        })])
    }

    async fetchRefundStatus(bookingId: number, userId: number) {
        let booking = await prisma.booking.findFirst({
            where: { id: bookingId, customerId: userId, },
            include: this.includes
        })

        const transaction = await prisma.transaction.findFirst({
            where: {
                bookingId,
                type: PaymentTypes.refunded,
                transactionStatus: "Pending"
            }
        })
        if (booking?.status !== BookingStatus.refund_pending)
            return booking

        if (!transaction) {
            // Check whether the request is from admin app or customer app
            if (booking) {
                return booking
            } else {
                throw new ErrorModel({
                    code: 404,
                    message: "No pending transactions available",
                    name: "Refund not found"
                })
            }
        }

        const PAYMENT_GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL

        if (!PAYMENT_GATEWAY_URL)
            throw new ErrorModel({
                code: 500,
                name: "Payment Gateway Url initialization failed",
                message: "Environment config invalid"
            })

        const merchantId = process.env.PAYMENT_MERCHANT_ID
        const index = process.env.PAYMENT_SALT_INDEX
        const key = process.env.PAYMENT_SALT_KEY
        const xVerify = sha256(`/pg/v1/status/${merchantId}/${transaction.id}` + key) + "###" + index

        const options = {
            method: 'get',
            url: `${PAYMENT_GATEWAY_URL}/pg/v1/status/${merchantId}/${transaction.id}`,
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': xVerify,
                "X-MERCHANT-ID": merchantId
            },
        }

        const res = await axios.request(options)
        logger.info(JSON.stringify(res.data))
        const code = res.data["code"] as PhonePePaymentCode

        if (code === "PAYMENT_SUCCESS")
            [booking] = await Promise.all([
                this.statusUpdate(bookingId, BookingStatus.refund_completed, userId),
                prisma.transaction.update({
                    where: { id: transaction.id, },
                    data: { transactionStatus: toTitleCase(res.data.data["state"]) }
                }),
            ])
        else if (code === "PAYMENT_PENDING") {
            throw new ErrorModel({
                code: 422,
                message: "Refund is still pending",
                name: "Refund not completed"
            })
        } else {
            [booking] = await Promise.all([
                this.statusUpdate(bookingId, BookingStatus.refund_failed, userId),
                prisma.transaction.update({
                    where: { id: transaction.id, },
                    data: { transactionStatus: toTitleCase(res.data.data["state"]) }
                }),
            ])
        }
        return booking

    }

    async #warrantyRequestValidity(bookingId: number) {
        const booking = await this.prismaBooking.findUnique({
            where: { id: bookingId },
            select: {
                service: true,
                createdAt: true
            }
        })
        let validity = false
        const createdAt = booking?.createdAt
        const warrantyPeriod = booking?.service?.warrantyPeriod
        const warrantyPeriodType = booking?.service?.warrantyPeriodType

        if (createdAt && warrantyPeriod && warrantyPeriodType) {

            const createdAtDate = new Date(createdAt);

            const currentDate = new Date();

            const expirationDate = new Date(createdAtDate);
            if (warrantyPeriodType === 'day') {
                expirationDate.setDate(expirationDate.getDate() + warrantyPeriod);
            } else if (warrantyPeriodType === 'month') {
                expirationDate.setMonth(expirationDate.getMonth() + warrantyPeriod);
            } else if (warrantyPeriodType === 'week') {
                expirationDate.setDate(expirationDate.getDate() + warrantyPeriod * 7);
            } else if (warrantyPeriodType === 'year') {
                expirationDate.setFullYear(expirationDate.getFullYear() + warrantyPeriod);
            } else {
                throw new Error('Invalid warrantyPeriodType');
            }

            validity = !(currentDate > expirationDate);
        }

        return validity
    }

    async #isInsideTamilNadu(addressId: number) {
        const address = await prisma.address.findUnique({ where: { id: addressId }, include: { geolocation: true } })
        return address && address.geolocation?.addressLine?.toLowerCase().includes("tamil nadu")
    }
    #validStatusChange(currentStatus: BookingStatus, toBeStatus: BookingStatus): boolean {
        return BookingStatusMap[currentStatus].includes(toBeStatus)
    }
}