import { Blog, BlogTags } from "@prisma/client";
import { prisma } from "../..";
import { PAGE_LIMIT } from "../shared/constants/paginationMeta";
import { GlobalSearchParams } from "./UserModel";
import { SortEnum } from "../shared/enum/sort-enum";

type OrderKeys = "title" | "createdAt"

type FilterKeys = {
    search?: string
    isPublished: boolean
    tagIds?: number[]
}

interface SearchParams extends GlobalSearchParams {
    orderBy?: Record<OrderKeys, SortEnum>
    filterBy?: FilterKeys
}

interface BlogListResponse {
    blogs: Array<Blog>,
    meta: SearchParams
}

export interface BlogParams {
    title: string
    authorName: string
    content: string
    slug: string
    tagIds?: number[]
    tagNames?: string[]
    coverPictureId: number
    isPublished?: boolean
    serviceId: number
}

export interface BlogUpdateParams {
    id?: number
    title?: string
    authorName?: string
    content?: string
    slug?: string
    tagIds?: number[]
    tagNames?: string[]
    coverPictureId?: number
    isPublished?: boolean
    serviceId?: number
}

class BlogModel {
    prismaBlog;
    prismaBlogTags;
    includes;
    constructor() {
        this.prismaBlog = prisma.blog
        this.prismaBlogTags = prisma.blogTags
        this.includes = {
            tags: true,
            coverPicture: true
        }
    }


    async index(params?: SearchParams): Promise<BlogListResponse> {

        const take = params?.limit || PAGE_LIMIT;
        const skip = ((params?.page || 1) - 1) * take;

        const where = {};

        if (params?.filterBy?.search)
            Object.assign(where, {
                OR: [
                    { title: { contains: params.filterBy.search, mode: 'insensitive' } },
                    { authorName: { contains: params.filterBy.search, mode: 'insensitive' } },
                    { tags: { some: { tag: { contains: params.filterBy.search, mode: 'insensitive' } } } }
                ],
            });

        if (params?.filterBy?.isPublished !== undefined || params?.filterBy?.isPublished !== null)
            Object.assign(where, {
                isPublished: params?.filterBy?.isPublished
            });

        if (params?.filterBy?.tagIds)
            Object.assign(where, {
                tags: { some: { id: { in: params?.filterBy?.tagIds } } }
            });

        const blogs = await this.prismaBlog.findMany({
            take,
            skip,
            where,
            include: this.includes,
            orderBy: params?.orderBy || { createdAt: "desc" },
        })
        const totalCount = await this.prismaBlog.count({ where })

        const meta: SearchParams = {
            page: 1,
            limit: PAGE_LIMIT,
            ...params,
            totalCount,
        }
        return { blogs, meta }
    }

    async metaIndex(search?: string): Promise<Array<BlogTags>> {

        const where = {};

        if (search)
            Object.assign(where, {
                OR: [
                    { tag: { contains: search, mode: 'insensitive' } },
                ],
            });

        const tags = await this.prismaBlogTags.findMany({
            where,
        })

        return tags
    }

    async show(slug: string): Promise<Blog | null> {
        return await this.prismaBlog.findUnique({
            where: {
                slug
            },
            include: {
                coverPicture: true,
                tags: true,
                service: { select: { id: true, name: true, attachments: true } },
            }
        })
    }

    async create(data: BlogParams): Promise<Blog> {

        const tags = await this.tagConnectionHandler(data.tagNames || [], data.tagIds || [])

        return await this.prismaBlog.create({
            data: {
                title: data.title,
                slug: data.slug,
                authorName: data.authorName,
                content: data.content,
                coverPictureId: data.coverPictureId,
                serviceId: data.serviceId,
                isPublished: data.isPublished,
                tags
            },
            include: {
                tags: true,
                coverPicture: true,
                service: { select: { id: true, name: true } },
            }
        })
    }

    async update(id: number, data: BlogUpdateParams): Promise<Blog> {
        const blog = await prisma.blog.findUnique({
            where: { id },
            include: { tags: { select: { id: true } } }
        })
        const missingIds = blog?.tags?.filter(tag => !data.tagIds?.includes(tag.id));

        const tags: any = await this.tagConnectionHandler(data.tagNames || [], data.tagIds || [])
        tags.disconnect = missingIds

        return await this.prismaBlog.update({
            where: { id },
            data: {
                title: data.title,
                authorName: data.authorName,
                content: data.content,
                slug: data.slug,
                coverPictureId: data.coverPictureId,
                serviceId: data.serviceId,
                isPublished: data.isPublished,
                tags,
                ...(!blog?.isPublished && data.isPublished && { createdAt: new Date() }),
            },
            include: {
                coverPicture: true,
                tags: true,
                service: { select: { id: true, name: true } },
            }
        })
    }

    async delete(id: number): Promise<Blog | null> {
        return await this.prismaBlog.delete({
            where: {
                id
            }
        })
    }

    async tagConnectionHandler(tagNames: string[], tagIds: number[]) {
        const existingTags = (await Promise.all(tagNames?.map(tag => prisma.blogTags.findFirst({
            where: {
                tag
            }
        })) || [])).filter(Boolean)
        const filteredTagsNames = tagNames?.filter(tagName =>
            !existingTags.find(tag => tag?.tag === tagName)
        ).map(tag => ({
            tag
        }))
        const tags = {
            connect: tagIds?.map(tagId => ({
                id: tagId
            })),
            create: filteredTagsNames
        }
        return tags
    }

}

export default BlogModel