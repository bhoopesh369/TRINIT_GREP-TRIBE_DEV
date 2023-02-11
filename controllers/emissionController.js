const prisma = require("../prisma");
const calculateCarbon = require('../utils/carbon');

module.exports.postEmissions = async (req, res) => {
    const { session } = req.cookies;
    const { url, data } = req.body;
    try {
        const carbon = await calculateCarbon(url, data);
        if (await prisma.emission.findFirst({
            where: {
                sessionId: session,
                url,
            }
        }) === null) {
            await prisma.emission.create({
                data: {
                    sessionId: session,
                    url,
                    carbon,
                    requests: 1,
                }
            });
        } else {
            await prisma.emission.update({
                where: {
                    sessionId: session,
                    url,
                },
                data: {
                    carbon: {
                        increment: carbon,
                    },
                    requests: {
                        increment: 1,
                    }
                }
            });
        }
        res.status(200).json("Emissions posted successfully");
    } catch (err) {
        res.status(400);
        console.log("Error: " + err);
    }
}

module.exports.getCurrentSessionEmissions = async (req, res) => {
    const { session } = req.cookies;
    try {
        const emissions = await prisma.emission.aggregate({
            where: {
                sessionId: session,
            },
            _sum: {
                carbon: true,
            }
        });
        res.status(200).json(emissions._sum.carbon);
    } catch (err) {
        res.status(400);
        console.log("Error: " + err);
    }
}

module.exports.getSessionWiseEmissions = async (req, res) => {
    const { session } = req.cookies;
    try {
        const sessionEntity = await prisma.session.findUnique({
            where: {
                sessionId: session,
            }
        });
        const sessions = await prisma.session.findMany({
            where: {
                userId: sessionEntity.userId,
            },
            select: {
                id: true,
                startTime: true,
            }
        });
        const response = sessions.sort((a, b) => a.startTime < b.startTime).map(async session => {
            const emissions = await prisma.emission.findMany({
                where: {
                    sessionId: session.id,
                }
            });
            return {
                session: session.id,
                startTime: session.startTime,
                emissions: emissions.map(emission => {
                    return {
                        url: emission.url,
                        carbon: emission.carbon,
                    }
                }),
            }
        });
        res.status(200).json(response);
    } catch (err) {
        res.status(400);
        console.log("Error: " + err);
    }
}

module.exports.totalEmissions = async (req, res) => {
    const { session } = req.cookies;
    try {
        const sessionEntity = await prisma.session.findUnique({
            where: {
                sessionId: session,
            }
        });
        const emissions = await prisma.emission.aggregate({
            where: {
                userId: sessionEntity.userId,
            },
            _sum: {
                carbon: true,
            }
        });
        res.status(200).json(emissions._sum.carbon);
    } catch (err) {
        res.status(400);
        console.log(err);
    }
};

module.exports.rankWebsites = async (req, res) => {
    try {
        const emissions = await prisma.emission.groupBy({
            by: ["url"],
            _sum: {
                carbon: true,
                requests: true,
            }
        });
        const response = emissions.map(emission => {
            return {
                url: emission.url,
                carbon: emission._sum.carbon / emission._sum.requests,
            }
        });
        res.status(200).json(response);
    } catch (err) {
        res.status(400);
        console.log(err);
    }
}
