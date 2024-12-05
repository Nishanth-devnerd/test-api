import { Response, NextFunction } from "express"
import Request from "../shared/interfaces/Request"
import { BaseKey } from "../shared/constants/BaseKeyConstants"
import BranchBlogService from "../services/branchBlog"
import { BranchBlogListingParamsValidationSchema, BranchBlogSchema, BranchBlogUpdateSchema } from "../validations/branchBlog"
import { ErrorModel } from "../models/ErrorModel"
import { removeFalsyKeys } from "../shared/utils/removeFalsyKeys"
import { serialize } from "serializr"
import { BranchBlogFilterSerializer } from "../serializers/BranchBlogSerializer"


const BranchBlogController = () => {

    const index = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const params = await BranchBlogListingParamsValidationSchema.validate(request.query, { stripUnknown: true })

            const filterBy = serialize(BranchBlogFilterSerializer, params.filterBy)

            const serializedFilterKeys = removeFalsyKeys(filterBy)

            if (serializedFilterKeys)
                params.filterBy = serializedFilterKeys as any

            const { branchBlogs, meta } = await new BranchBlogService().index(params as any)


            response
                .status(200)
                .json({ branchBlogs, meta })
        } catch (error) {
            next(error)
        }
    }

    const metaIndex = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const params = await BranchBlogListingParamsValidationSchema.validate(request.query, { stripUnknown: true })

            const filterBy = serialize(BranchBlogFilterSerializer, params.filterBy)

            const serializedFilterKeys = removeFalsyKeys(filterBy)

            if (serializedFilterKeys)
                params.filterBy = serializedFilterKeys as any

            const branchBlogs = await new BranchBlogService().metaIndex(params as any)

            response
                .status(200)
                .json({ branchBlogs })
        } catch (error) {
            next(error)
        }
    }

    const create = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const data = await BranchBlogSchema.validate(
                request.body[BaseKey.BRANCH_BLOG],
                { stripUnknown: true, abortEarly: false }
            );

            const branchBlog = await new BranchBlogService().create(data)

            response.status(200).json({ branchBlog })
        } catch (error) {
            next(error)
        }
    }

    const update = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const blogId = Number(request.params["blogId"])

            if (!blogId || isNaN(blogId)) throw new ErrorModel({ statusCode: 422, message: "Branch blog id missing!", name: "Invalid request" })
            const data = await BranchBlogUpdateSchema.validate(
                request.body[BaseKey.BRANCH_BLOG],
                { stripUnknown: true, abortEarly: false }
            );

            const branchBlog = await new BranchBlogService().update(blogId, data)

            response.status(200).json({ branchBlog })
        } catch (error) {
            next(error)
        }
    }

    const remove = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const blogId = +request.params["blogId"]

            if (!blogId || isNaN(blogId)) throw new ErrorModel({ statusCode: 422, message: "Branch blog id missing!", name: "Invalid request" })

            await new BranchBlogService().delete(blogId)

            response.status(200).json({})
        } catch (error) {
            next(error)
        }
    }

    const show = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const blogId = +request.params["blogId"]

            if (!blogId || isNaN(blogId)) throw new ErrorModel({ statusCode: 422, message: "Branch blog id missing!", name: "Invalid request" })

            const branchBlog = await new BranchBlogService().show(blogId)
            response.status(200).json({ branchBlog })
        } catch (error) {
            console.log(error)
            next(error)
        }
    }

    return {
        index,
        metaIndex,
        create,
        remove,
        update,
        show,
    }
}

export default BranchBlogController