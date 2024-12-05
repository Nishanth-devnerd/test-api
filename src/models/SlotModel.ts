import { Slot } from "@prisma/client";
import { prisma } from "../..";
import ServiceModel from "./ServiceModel";
import { SERVICE_SLOT_CREATION_DATE } from "../shared/constants/ServiceSlotCreationDays";
import { ErrorModel } from "./ErrorModel";

interface SlotParams {
    duration: number
    startTime: Date
    endTime: Date
}

interface SlotTimings {
    startTime: Date;
    endTime: Date;
}

interface SlotStatus {
    date: Date
    id?: number
}

class SlotModel {
    #prismaSlot;

    constructor() {
        this.#prismaSlot = prisma.slot
    }

    #divideIntoSlots(start: Date, end: Date, slotDuration: number): SlotTimings[] {
        const slots: SlotTimings[] = [];
        let currentTime = new Date(new Date(start).setSeconds(0));
        end = new Date(end.setSeconds(0));

        while (currentTime < end) {
            const slotEndTime = new Date(currentTime.getTime() + slotDuration * 60000);
            const actualEndTime = slotEndTime < end ? slotEndTime : end;

            slots.push({ startTime: currentTime, endTime: actualEndTime });
            currentTime = slotEndTime;
        }

        return slots;
    }

    #getDatesBetween(startDate: Date, endDate: Date): Date[] {
        const dates: Date[] = [];
        let currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            dates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return dates;
    }

    #getDatesAfter(startDate: Date, numDates: number): Date[] {
        const dates: Date[] = [];
        let currentDate = new Date(startDate);

        for (let i = 0; i < numDates; i++) {
            dates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return dates;
    }

    async index(serviceId: number) {

        const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { id: true, bookBeforeInDays: true } })

        if (!service?.id) throw new ErrorModel({ statusCode: 422, name: "No service with id", message: "Service not found" })

        const today = new Date();
        const afterAvailablity = new Date(today);
        afterAvailablity.setDate(today.getDate() + service.bookBeforeInDays);

        return await prisma.slot.findMany({
            where: {
                serviceId,
                isNonBookable: false,
                date: {
                    gte: afterAvailablity
                },
                active: true
            }
        })

    }

    async create(serviceId: number, slotData: SlotParams) {

        const [service, _] = await Promise.all(
            [
                new ServiceModel().update(serviceId, {
                    slotDuration: slotData.duration,
                    slotStartAt: slotData.startTime,
                    slotEndAt: slotData.endTime,
                }),

                this.#prismaSlot.findMany({
                    where: {
                        serviceId,
                        date: {
                            gte: new Date()
                        }
                    }
                })
            ])

        if (!service) return false;

        const slots = this.#divideIntoSlots(slotData.startTime, slotData.endTime, slotData.duration);
        const dates = service.activeTill
            ? this.#getDatesBetween(service.activeFrom, service.activeTill)
            : this.#getDatesAfter(new Date(), SERVICE_SLOT_CREATION_DATE)

        const dateSlots = dates.map(date => slots.map(slot => ({
            ...slot,
            date,
            active: true,
            serviceId
        }))).flat()

        await this.#prismaSlot.createMany({
            data: dateSlots
        })

        return true

    }

    async changeStatus(serviceId: number, slotData: SlotStatus, toEnable: boolean) {
        await this.#prismaSlot.updateMany({
            where: {
                serviceId,
                date: slotData.date,
                id: slotData.id
            },
            data: {
                active: toEnable
            }
        })
        const slots = await this.#prismaSlot.findMany({
            where: {
                serviceId,
                date: slotData.date,
                id: slotData.id
            }
        })
        return slots
    }
}

export default SlotModel