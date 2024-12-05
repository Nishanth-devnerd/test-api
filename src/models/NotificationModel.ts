import { BookingStatus, Notification, NotificationType } from "@prisma/client";
import { prisma } from "../..";
import { PAGE_LIMIT } from "../shared/constants/paginationMeta";
import { SortEnum } from "../shared/enum/sort-enum";
import { GlobalSearchParams } from "./UserModel";

export interface NotificationParams {
    subject: string
    content: string
    userIds: number[]
    type: NotificationType
}

type FilterKeys = {
    search?: string
    active?: boolean
    type: NotificationType
}

type OrderKeys = "id" | "subject" | "createdAt"

interface SearchParams extends GlobalSearchParams {
    orderBy?: Record<OrderKeys, SortEnum>
    filterBy?: FilterKeys
}

class NotificationModel {
    prismaNotification;
    constructor() {
        this.prismaNotification = prisma.notification;
    }

    async index(params: SearchParams) {

        const take = params?.limit || PAGE_LIMIT;
        const skip = ((params?.page || 1) - 1) * take;

        const where = {
            type: params.filterBy?.type
        };

        if (params?.filterBy?.search)
            Object.assign(where, {
                OR: [
                    { search: params?.filterBy?.search }
                ],
            });


        const notifications = await this.prismaNotification.findMany({
            take,
            skip,
            where,
            orderBy: params?.orderBy || { createdAt: "desc" },
        })

        const totalCount = await this.prismaNotification.count({ where })

        const meta: SearchParams = {
            page: 1,
            limit: PAGE_LIMIT,
            ...params,
            totalCount,
        }

        return { notifications, meta }
    }

    async show(notificationId: number) {
        return await this.prismaNotification.findUnique({
            where: {
                id: notificationId
            },
            include: {
                customerNotifications: true
            }
        })
    }

    async create(data: NotificationParams) {
        const notification = await this.prismaNotification.create({
            data: {
                type: data.type,
                subject: data.subject,
                content: data.content
            }
        })

        await prisma.customerNotification.createMany({
            data: [
                ...data.userIds.map(userId => ({
                    customerId: userId,
                    notificationId: notification.id
                }))
            ]
        })

        return notification
    }

}

export default NotificationModel