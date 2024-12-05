import { Review, ReviewStatus } from "@prisma/client";
import { prisma } from "../..";
import { OfferParams, OfferUpdateParams } from "./CategoryModel";
import { PAGE_LIMIT } from "../shared/constants/paginationMeta";
import { GlobalSearchParams } from "./UserModel";
import { SortEnum } from "../shared/enum/sort-enum";

export interface ReviewParams {
    rating: number
    reviewComment?: string
    serviceId: number
    userId: number
}

type FilterKeys = {
    search?: string
    status: ReviewStatus
}

interface ReviewListResponse {
    reviews: Array<Review>,
    meta: SearchParams
}
type OrderKeys = "service" | "customer" | "rating"

interface SearchParams extends GlobalSearchParams {
    orderBy?: Record<OrderKeys, SortEnum>
    filterBy?: FilterKeys
}


export interface ReviewUpdateParams {
    rating?: number
    reviewComment?: string
}

class ReviewModel {
    prismaReview;
    constructor() {
        this.prismaReview = prisma.review;
    }

    async index(params?: SearchParams): Promise<ReviewListResponse> {

        const take = params?.limit || PAGE_LIMIT;
        const skip = ((params?.page || 1) - 1) * take;

        const where = {
            status: params?.filterBy?.status
        };

        if (params?.filterBy?.search)
            Object.assign(where, {
                OR: [
                    { service: { name: { contains: params.filterBy.search, mode: 'insensitive' } } },
                ],
            });


        if (params?.orderBy?.service)
            params = {
                orderBy: { service: { name: params.orderBy.service } } as any
            }

        if (params?.orderBy?.rating)
            params = {
                orderBy: { rating: params.orderBy.rating } as any
            }

        if (params?.orderBy?.customer)
            params = {
                orderBy: { user: { name: params.orderBy.customer } } as any
            }

        const reviews = await this.prismaReview.findMany({
            ...(!params?.export ? { take, skip } : {}),
            where,
            orderBy: params?.orderBy as any || { createdAt: "desc" },
            include: {
                service: { select: { id: true, name: true } },
                user: { select: { name: true, mobile: true, id: true } }
            },
        })

        const totalCount = await this.prismaReview.count({ where })

        const meta: SearchParams = {
            page: 1,
            limit: PAGE_LIMIT,
            ...params,
            totalCount,
        }

        return { reviews, meta }
    }

    async show(reviewId: number) {
        return await this.prismaReview.findUnique({
            where: {
                id: reviewId
            },
            include: {
                user: true,
                service: true
            }
        })
    }

    async create(data: ReviewParams): Promise<Review> {
        const review = await this.prismaReview.upsert({
            create: data,
            update: {
                ...data,
                status: "pending"
            },
            where: {
                serviceId_userId: {
                    userId: data.userId,
                    serviceId: data.serviceId
                }
            }
        })

        this.#calculateOverallReview(review.serviceId)
        return review
    }

    async update(reviewId: number, data: ReviewUpdateParams): Promise<Review> {
        const review = await this.prismaReview.update({
            where: { id: reviewId },
            data: {
                ...data,
                status: "pending"
            },
        })

        this.#calculateOverallReview(review.serviceId)
        return review
    }

    async updateStatus(reviewId: number, status: ReviewStatus): Promise<Review> {
        const review = await this.prismaReview.update({
            where: { id: reviewId },
            data: { status },
        })

        this.#calculateOverallReview(review.serviceId)
        return review
    }

    async delete(reviewId: number): Promise<Review> {

        const review = await this.prismaReview.delete({
            where: { id: reviewId },
        })

        this.#calculateOverallReview(review.serviceId)
        return review
    }

    async #calculateOverallReview(serviceId: number) {
        const service = await prisma.service.findUnique({
            where: {
                id: serviceId
            },
            include: {
                reviews: {
                    where: {
                        status: "approved"
                    }
                }
            }
        })

        await prisma.service.update({
            where: {
                id: serviceId
            },
            data: {
                overallRating:
                    (service?.reviews.reduce((agg, review) => agg + review.rating, 0) || 0)
                    / (service?.reviews.length || 1)
            }
        })
    }
}

export default ReviewModel