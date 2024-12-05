import { Geolocation, Location, PrismaClient } from "@prisma/client";

export interface GeolocationParams {
    id?: number
    latitude: number
    longitude: number
    city: string
    state: string
    pincode: string
    addressLine?: string
}
export interface GeolocationUpdateParams {
    id?: number
    latitude?: number
    longitude?: number
    city?: string
    state?: string
    pincode?: string
    addressLine?: string
}

class GeolocationModel {

    constructor(private readonly prismaGeolocation: PrismaClient['geolocation']) { }


    async connect(data: GeolocationParams): Promise<Geolocation> {
        return await this.prismaGeolocation.create({
            data
        })
    }

    async update(id: number, data: GeolocationUpdateParams): Promise<Geolocation> {

        return await this.prismaGeolocation.update({
            where: { id },
            data: {
                ...data
            }
        })
    }

}

export default GeolocationModel