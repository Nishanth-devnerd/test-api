import cors from "cors"
import express, { Express } from 'express';
import { PrismaClient } from "@prisma/client"
import dotenv from 'dotenv';
import path from "path"

const environment = process.env.NODE_ENV || 'development'
dotenv.config({ path: `config/${environment}.env` });

export const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

import routes from './src/routes';
import routeConstants from './src/shared/constants/RouteConstants';
import errorHandler from './src/shared/middlewares/errorHandler';
import "./src/jobs";
import logger from "./src/shared/utils/logger";
import aws from "aws-sdk"
import { requestIdGenerator } from "./src/shared/utils/requestIdGenerator";

const app: Express = express();

app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));
const dir = path.join(__dirname, "..", 'public');
app.use(express.static(dir));
app.set("view engine", "ejs");

const port = process.env.PORT;
aws.config.update({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

app.get("/", (req, res) => res.send("Express on Vercel"));

app.use(requestIdGenerator)

app.use(routeConstants.API_V1, routes)

app.use(errorHandler)

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error, e) => {
    logger.error('Uncaught Exception:', error);
});

prisma.$connect()
    .then(() => {
        const server = app.listen(port, async () => {
            console.log(`⚡️[server]: Server is running at http://localhost:${port} in ${environment} environment`);

            process.on('SIGINT', async () => {
                console.log('Stopping server...');
                await prisma.$disconnect();
                console.log('Server stopped.');
                server.close(() => {
                    console.log('Server closed.');
                    process.exit(0);
                });
            });
        });
    })
    .catch(err => {
        console.log(err)
        process.exit(0);
    })
