import { deserialize, serialize } from "serializr"
import BlogModel from "../../models/BlogModel"
import Request from "../../shared/interfaces/Request"
import { NextFunction, Response } from "express"
import { removeFalsyKeys } from "../../shared/utils/removeFalsyKeys"
import { ErrorModel } from "../../models/ErrorModel"
import { BaseKey } from "../../shared/constants/BaseKeyConstants"
import { BlogListingParamsValidationSchema, BlogTagParamsValidationSchema, BlogUpdateValidationSchema, BlogValidationSchema } from "./blog.validation"
import { BlogFilterSerializer, BlogSerializer, BlogTagsMetaSerializer, BlogTagsSerializer } from "../../serializers/BlogSerializer"

const BlogController = () => {

    const index = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const params = await BlogListingParamsValidationSchema.validate(request.query, { stripUnknown: true })

            const orderBy = serialize(BlogSerializer, params?.orderBy as any)

            const filterBy = serialize(BlogFilterSerializer, params.filterBy)

            const serializedSortKeys = removeFalsyKeys(orderBy)

            const serializedFilterKeys = removeFalsyKeys(filterBy)

            if (serializedSortKeys)
                params.orderBy = serializedSortKeys
            else
                delete params?.orderBy

            if (serializedFilterKeys)
                params.filterBy = serializedFilterKeys as any

            const { blogs, meta } = await new BlogModel().index(params as any)


            response
                .status(200)
                .json({ blogs, meta })
        } catch (error) {
            next(error)
        }
    }


    const metaIndex = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const params = await BlogTagParamsValidationSchema.validate(request.query, { stripUnknown: true })

            const tags = await new BlogModel().metaIndex(params.search)

            response
                .status(200)
                .json({ tags: deserialize(BlogTagsMetaSerializer, tags) })
        } catch (error) {
            next(error)
        }
    }

    const show = async (request: Request, response: Response, next: NextFunction) => {

        try {
            const blogSlug = request.params["blogSlug"]

            if (!blogSlug) throw new ErrorModel({ statusCode: 422, message: "Blog id missing!", name: "Invalid request" })

            const blog = await new BlogModel().show(blogSlug)

            response
                .status(200)
                .json({ blog })
        } catch (error) {
            next(error)
        }
    }

    const create = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const body = await BlogValidationSchema.validate(request.body[BaseKey.BLOG], { stripUnknown: true })

            const blog = await new BlogModel().create(body)

            response
                .status(201)
                .json({ blog })
        } catch (error) {
            next(error)
        }
    }

    const update = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const blogId = +request.params["blogId"]

            if (!blogId || isNaN(blogId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Blog id missing!",
                    name: "Invalid request"
                })

            const body = await BlogUpdateValidationSchema.validate(request.body[BaseKey.BLOG], { stripUnknown: true })

            const blog = await new BlogModel().update(blogId, body)

            response
                .status(200)
                .json({ blog })
        } catch (error) {
            next(error)
        }
    }

    const remove = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const blogId = +request.params["blogId"]

            if (!blogId || isNaN(blogId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Blog id missing!",
                    name: "Invalid request"
                })

            await new BlogModel().delete(blogId)

            response
                .status(200)
                .json({})
        } catch (error) {
            next(error)
        }
    }

    return {
        create,
        show,
        index,
        update,
        remove,
        metaIndex,
    }
}

export default BlogController