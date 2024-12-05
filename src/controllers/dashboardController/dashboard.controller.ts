import { prisma } from "../../.."
import DashboardService from "../../services/dashboard"
import Request from "../../shared/interfaces/Request"
import { NextFunction, Response } from "express"

const DashboardController = () => {

    const revenueGraphData = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const revenueData = await prisma.revenueStats.findMany({})

            response
                .status(200)
                .json({ revenueData })
        } catch (error) {

        }
    }

    const userGraphData = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const userData = await prisma.userStats.findMany({})

            response
                .status(200)
                .json({ userData })
        } catch (error) {

        }
    }

    const bookingsGraphData = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const bookingData = await prisma.salesStats.findMany({})

            response
                .status(200)
                .json({ bookingData })
        } catch (error) {

        }
    }

    const topServicesData = async (request: Request, response: Response, next: NextFunction) => {
        try {

        } catch (error) {

        }
    }

    const getDashboardStats = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const dashboard = new DashboardService()
            const [activeCustomers, newCustomers, totalCustomers, revenue] = await Promise.all([
                dashboard.getActiveCustomers(),
                dashboard.getNewCustomers(),
                dashboard.getTotalCustomers(),
                dashboard.getTotalRevenue()
            ])
            response
                .status(200)
                .json({ dashboardStats: { activeCustomers, newCustomers, totalCustomers, revenue } })
        } catch (error) {

        }
    }

    return {
        getDashboardStats,
        revenueGraphData,
        userGraphData,
        bookingsGraphData,
        topServicesData,
    }

}

export default DashboardController