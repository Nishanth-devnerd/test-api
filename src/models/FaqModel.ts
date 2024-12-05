import { Faq } from "@prisma/client";
import { prisma } from "../..";

export interface FaqParams {
    id?: number
    title: string
    description: string
    serviceId: number
}

export interface FaqUpdateParams {
    id: number
    title?: string
    description?: string
}

class FaqModel {
    prismaFaq;
    constructor() {
        this.prismaFaq = prisma.faq;
    }

    async index(serviceId: number): Promise<Array<Faq>> {
        return this.prismaFaq.findMany({
            where: { serviceId }
        })
    }

    async create(data: FaqParams): Promise<Faq> {
        return await this.prismaFaq.create({
            data,
        })
    }

    async updateMany(serviceId: number, data: Array<FaqUpdateParams>): Promise<Array<Faq>> {
        for (const faq of data) {
            await this.prismaFaq.update({
                where: { id: faq.id },
                data: {
                    serviceId,
                    title: faq.title,
                    description: faq.description,
                }
            })
        }

        return await this.prismaFaq.findMany({
            where: { serviceId }
        })
    }

    async delete(id: number): Promise<void> {
        await this.prismaFaq.delete({
            where: { id }
        })
        return;
    }

}

export default FaqModel