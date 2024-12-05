import { Coupon } from "@prisma/client";
import { prisma } from "../..";
import { OfferParams, OfferUpdateParams } from "./CategoryModel";
import { PAGE_LIMIT } from "../shared/constants/paginationMeta";
import { GlobalSearchParams } from "./UserModel";
import { SortEnum } from "../shared/enum/sort-enum";
import { validateOfferExpiring } from "../jobs/offer";

interface CouponOfferParams extends OfferParams {
    title: string,
    description?: string
}

interface CouponOfferUpdateParams extends OfferUpdateParams {
    id: number,
    title?: string,
    description?: string
}

export interface CouponParams {
    offer: CouponOfferParams
}

export interface CouponUpdateParams {
    active?: boolean
    offer?: CouponOfferUpdateParams
}

type OrderKeys = "name" | "active"

type FilterKeys = {
    search?: string
    active?: boolean
    isExpired?: boolean
}

interface SearchParams extends GlobalSearchParams {
    orderBy?: Record<OrderKeys, SortEnum>
    filterBy?: FilterKeys
}

interface CouponsListResponse {
    coupons: Array<Coupon>,
    meta: SearchParams
}

class CouponModel {
    prismaCoupon;
    constructor() {
        this.prismaCoupon = prisma.coupon;
    }

    async index(params?: SearchParams): Promise<CouponsListResponse> {

        const take = params?.limit || PAGE_LIMIT;
        const skip = ((params?.page || 1) - 1) * take;

        const where = {
            // active: true,
        };

        if (params?.filterBy?.search)
            Object.assign(where, {
                OR: [
                    { offer: { title: { contains: params.filterBy.search, mode: 'insensitive' } } },
                    { offer: { description: { contains: params.filterBy.search, mode: 'insensitive' } } }
                ],
            });

        if (params?.filterBy?.isExpired !== undefined && params?.filterBy?.isExpired !== null)
            Object.assign(where, { offer: { isExpired: params?.filterBy?.isExpired } })

        if (params?.filterBy?.active !== undefined && params?.filterBy?.active !== null)
            Object.assign(where, {
                active: params?.filterBy?.active,
            });

        const coupons = await this.prismaCoupon.findMany({
            ...(!params?.export ? { take, skip } : {}),
            where,
            orderBy: params?.orderBy || { createdAt: "desc" },
            include: {
                offer: true,
                _count: {
                    select: {
                        bookings: true
                    }
                }
            }
        })
        const totalCount = await this.prismaCoupon.count({ where })

        const meta: SearchParams = {
            page: 1,
            limit: PAGE_LIMIT,
            ...params,
            totalCount,

        }
        return { coupons, meta }

    }

    async create(data: CouponParams): Promise<Coupon> {
        const date = new Date();
        // date.setDate(date.getDate() - 1);
        const isExpired = data.offer.validTill ? data.offer.validTill < date : false;

        return await this.prismaCoupon.create({
            data: {
                active: true,
                offer: {
                    create: {
                        ...data.offer,
                        isExpired,
                    }
                }
            },
            include: { offer: true }
        })
    }

    async update(couponId: number, data: CouponUpdateParams): Promise<Coupon> {

        const date = new Date();
        // date.setDate(date.getDate() - 1);
        const isExpired = data?.offer?.validTill ? data.offer.validTill < date : false;

        if (data.offer)
            await prisma.offer.update({
                where: { id: data.offer.id },
                data: {
                    ...data.offer,
                    isExpired,
                }
            })

        return await this.prismaCoupon.update({
            where: { id: couponId },
            data: {
                active: data.active
            },
            include: { offer: true }
        })
    }
}

export default CouponModel