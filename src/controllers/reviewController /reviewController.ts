import { NextFunction, Response } from "express";
import Request from "../../shared/interfaces/Request";
import { BaseKey } from "../../shared/constants/BaseKeyConstants";
import { ErrorModel } from "../../models/ErrorModel";
import ReviewModel from "../../models/ReviewModel";
import { RoleEnum } from "../../shared/enum/role-enum";
import { ReviewCreateValidationSchema, ReviewListingParamsValidationSchema, ReviewStatusUpdateValidationSchema, ReviewUpdateValidationSchema } from "./reviewController.validation";
import { removeFalsyKeys } from "../../shared/utils/removeFalsyKeys";
import { deserialize, serialize } from "serializr";
import { ReviewOrderSerializer, ReviewFilterSerializer } from "../../serializers/ReviewSerializer";

const ReviewController = () => {

    const index = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const params = await ReviewListingParamsValidationSchema.validate(request.query, { stripUnknown: true })

            const orderBy = serialize(ReviewOrderSerializer, { ...params?.orderBy } as unknown)

            const filterBy = serialize(ReviewFilterSerializer, { ...params?.filterBy } as unknown)

            const serializedSortKeys = removeFalsyKeys(orderBy, true)

            const serializedFilterKeys = removeFalsyKeys(filterBy, true)

            if (serializedSortKeys)
                params.orderBy = serializedSortKeys
            else
                delete params?.orderBy

            if (serializedFilterKeys)
                params.filterBy = serializedFilterKeys as any

            const { reviews, meta } = await new ReviewModel().index(params as any)

            response
                .status(200)
                .json({ reviews, meta })

        } catch (error) {
            next(error)
        }
    }


    const create = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const body = await ReviewCreateValidationSchema.validate(request.body[BaseKey.REVIEW], { stripUnknown: true, abortEarly: false })

            if (!request.user?.id)
                throw new ErrorModel({
                    code: 401,
                    name: "Unauthenticated user",
                    message: "User should be authenticated"
                })

            const review = await new ReviewModel().create({ ...body, userId: request.user.id })

            response
                .status(200)
                .json({ review })

        } catch (error) {
            next(error)
        }
    }

    const update = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const reviewId = Number(request.params["reviewId"])

            if (!reviewId || isNaN(reviewId)) throw new ErrorModel({ statusCode: 422, message: "Coupon id missing!", name: "Invalid request" })

            const body = await ReviewUpdateValidationSchema.validate(request.body[BaseKey.REVIEW], { stripUnknown: true, abortEarly: false })

            const review = await new ReviewModel().update(reviewId, body)

            response
                .status(200)
                .json({ review })

        } catch (error) {
            next(error)
        }
    }

    const updateStatus = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const reviewId = Number(request.params["reviewId"])

            if (!reviewId || isNaN(reviewId)) throw new ErrorModel({ statusCode: 422, message: "Coupon id missing!", name: "Invalid request" })

            const body = await ReviewStatusUpdateValidationSchema.validate(request.body[BaseKey.REVIEW], { stripUnknown: true, abortEarly: false })

            const review = await new ReviewModel().updateStatus(reviewId, body.status)

            response
                .status(200)
                .json({ review })

        } catch (error) {
            next(error)
        }
    }

    const deleteReview = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const reviewId = Number(request.params["reviewId"])

            if (!reviewId || isNaN(reviewId)) throw new ErrorModel({ statusCode: 422, message: "Coupon id missing!", name: "Invalid request" })

            const review = await new ReviewModel().show(reviewId)
            if (review?.userId === request.user?.id || request.user?.role.name === RoleEnum.ADMIN)
                await new ReviewModel().delete(reviewId)
            else
                throw new ErrorModel({
                    code: 422,
                    name: "Invalid request",
                    message: "Unable to delete the review"
                })

            response
                .status(200)
                .json()

        } catch (error) {
            next(error)
        }
    }

    return {
        index,
        create,
        update,
        updateStatus,
        deleteReview,
    }
}

export default ReviewController