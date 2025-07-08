import express from "express";
import axios, { Axios } from "axios";
import { InEndDate, InStartDate, showDate } from "./function/scripts.js";
import { carbonCalc } from "./function/scripts.js";
import puppeteer from "puppeteer";

const api = 'http://localhost:4000/';
const app = express();
const port = 3000;

app.use(express.static('public'))


app.get('/', (req, res) => {
    res.render('index.ejs');
})


app.get('/material-information', async (req, res) => {
    const startDate = req.query.startDate || showDate();
    const endDate = req.query.endDate || showDate();


    try {
        const [mat_wg, mat_st, price] = await Promise.all([
            axios.get(api + 'get_weight_by_deli/search', { params: { startDate: startDate, endDate: endDate } }),
            axios.get(api + 'get_weight_by_station/search', { params: { startDate: startDate, endDate: endDate } }),
            axios.get(api + 'materials')
        ]);

        const weightByDeli = mat_wg.data;
        const weightByStation = mat_st.data;
        const priceData = price.data;
        const combinedMaterials = {};
        weightByDeli.forEach(mat => {
            const key = mat.item_name;
            if (!combinedMaterials[key]) {
                combinedMaterials[key] = {
                    item_name: mat.item_name,
                    category: mat.category,
                    kg_delivery: parseFloat(mat.kg_delivery) || 0,
                    unit_delivery: parseFloat(mat.unit_delivery) || 0,
                    kg_station: 0,
                    unit_station: 0,
                    price_delivery: 0,
                    price_station: 0,
                    price_factory: 0,
                    quantity_delivery: parseFloat(mat.total_delivery) || 0,
                    quantity_station: 0,
                    total_delivery: Array.isArray(mat.total_delivery)
                    ? mat.total_delivery.reduce((total, arry) => total + parseFloat(arry || 0), 0) : parseFloat(mat.total_delivery) || 0,
                    total_station : 0

                };
            } else {
                combinedMaterials[key].kg_delivery += parseFloat(mat.kg_delivery) || 0;
                combinedMaterials[key].unit_delivery += parseFloat(mat.unit_delivery) || 0;
                if (Array.isArray(mat.total_delivery)) {
                    combinedMaterials[key] += mat.total_delivery.reduce((total, arry) => total + parseFloat(arry || 0),0)
                } else {
                    combinedMaterials[key].total_delivery += parseFloat(mat.total_delivery) || 0;
                }
                combinedMaterials[key].quantity_delivery = (parseFloat(combinedMaterials[key].quantity_delivery) + (parseFloat(mat.total_delivery) || 0))
            }
        });

        weightByStation.forEach(item => {
            const key = item.item_name;
            if (!combinedMaterials[key]) {
                combinedMaterials[key] = {
                    item_name: item.item_name,
                    category: item.category,
                    kg_delivery: 0,
                    unit_delivery: 0,
                    kg_station: parseFloat(item.kg_station) || 0,
                    unit_station: parseFloat(item.unit_station) || 0,
                    price_delivery: 0,
                    price_station: 0,
                    price_factory: 0,
                    quantity_delivery: 0,
                    quantity_station: parseFloat(item.total_station) || 0,
                    total_delivery: 0,
                    total_station : Array.isArray(item.total_station)
                    ? mat.total_delivery.reduce((total, arry) => total + parseFloat(arry || 0), 0): parseFloat(item.total_station) || 0
                };
            } else {
                combinedMaterials[key].kg_station += parseFloat(item.kg_station) || 0;
                combinedMaterials[key].unit_station += parseFloat(item.unit_station) || 0;
                combinedMaterials[key].quantity_station = (parseFloat(combinedMaterials[key].quantity_station) + (parseFloat(item.total_station) || 0))
            }
        });

        priceData.forEach(price => {
            const key = price.name_mat;
            if (!combinedMaterials[key]) {
                combinedMaterials[key] = {
                    item_name: price.name_mat,
                    category: price.name_group,
                    kg_delivery: 0,
                    unit_delivery: 0,
                    kg_station: 0,
                    unit_station: 0,
                    price_delivery: parseFloat(price.price_delivery) || 0,
                    price_station: parseFloat(price.price_station) || 0,
                    price_factory: parseFloat(price.price_factory) || 0,
                    quantity_delivery: 0,
                    quantity_station: 0,
                    total_delivery : 0,
                    total_station : 0
                };
            } else {
                combinedMaterials[key].price_delivery += parseFloat(price.price_delivery) || 0;
                combinedMaterials[key].price_station += parseFloat(price.price_station) || 0;
                combinedMaterials[key].price_factory += parseFloat(price.price_factory) || 0;

            }
        });
        const materials = Object.values(combinedMaterials);
        res.render('material-information.ejs', {
            counter: 1,
            materials: materials,
            startDate : startDate,
            endDate : endDate
        });
    } catch (err) {
        console.error('Error fetching data from API:', err);
        res.status(500).send('Error fetching data from API:');
    }
});


app.get('/report-50-Districts', async (req, res) => {
    const startDate = req.query.startDate || showDate();
    const endDate = req.query.endDate || showDate();


    try {
        const ghg = await axios.get(api + 'get_carbon_cal/search', {
            params: {
                startDate: startDate,
                endDate: endDate
            }
        });
        const ghgcalc = ghg.data;
        const ghgTotal = {};
		let PubcustomerSum = {
			kg_delivery: 0,
			total_delivery: 0,
			ghg: 0
		}
		console.log(ghgcalc);
		ghgcalc.forEach(entry => {
			if (entry.location == "ลูกค้าทั่วไป ..." || entry.location == " ") {
				PubcustomerSum.kg_delivery += parseFloat(entry.kg_delivery) || 0;
				PubcustomerSum.total_delivery += parseFloat(entry.total_delivery) || 0;
				PubcustomerSum.ghg += parseFloat(carbonCalc(entry, 'item_name', 'kg_delivery')) || 0;
			}
		})
        ghgcalc.forEach(ghg => {
            const key = ghg.amphures;
            if (!ghgTotal[key]) {
                ghgTotal[key] = {
                    purchase_date: ghg.purchase_date,
                    amphures: ghg.amphures,
                    provinces: ghg.provinces || 0,
                    kg_delivery: parseFloat(ghg.kg_delivery) || 0,
                    ghg: parseFloat(carbonCalc(ghg, 'item_name', 'kg_delivery')) || 0,
                    total_delivery : parseFloat(ghg.total_delivery) || 0
                };
            } else {
                ghgTotal[key].kg_delivery += parseFloat(ghg.kg_delivery) || 0;
                ghgTotal[key].ghg += parseFloat(carbonCalc(ghg, 'item_name', 'kg_delivery')) || 0;
                ghgTotal[key].total_delivery += parseFloat(ghg.total_delivery) || 0;
            }
        });

        const easternDis = [
			"เขตคลองสามวา",
			"เขตคันนายาว",
			"เขตบางกะปิ",
			"เขตบึงกุ่ม",
			"เขตประเวศ",
			"เขตมีนบุรี",
			"เขตลาดกระบัง",
			"เขตสะพานสูง",
            "เขตหนองจอก"
        ]
        const northDis = [
            "เขตจตุจักร",
			"เขตดอนเมือง",
			"เขตบางซื่อ",
			"เขตบางเขน",
			"เขตลาดพร้าว",
			"เขตสายไหม",
            "เขตหลักสี่"
        ]

        const centralDis = [
            "เขตดินแดง",
			"เขตดุสิต",
			"เขตป้อมปราบศัตรูพ่าย",
			"เขตพญาไท",
			"เขตพระนคร",
			"เขตราชเทวี",
            "เขตวังทองหลาง",
            "เขตห้วยขวาง",
			"เขตสัมพันธวงศ์"
        ]

        const southDis = [
            "เขตคลองเตย",
			"เขตบางคอแหลม",
			"เขตบางนา",
			"เขตบางรัก",
			"เขตปทุมวัน",
			"เขตพระโขนง",
			"เขตยานนาวา",
			"เขตวัฒนา",
            "เขตสวนหลวง",
            "เขตสาทร"
         ]
        const northTon = [
			"เขตคลองสาน",
			"เขตจอมทอง",
			"เขตตลิ่งชัน",
			"เขตทวีวัฒนา",
			"เขตธนบุรี",
			"เขตบางกอกน้อย",
            "เขตบางกอกใหญ่",
			"เขตบางพลัด"
        ]

        const southTon = [
			"เขตทุ่งครุ",
            "เขตบางขุนเทียน",
			"เขตบางบอน",
            "เขตบางแค",
			"เขตภาษีเจริญ",
            "เขตราษฎร์บูรณะ",
			"เขตหนองแขม"
        ]

        const total = Object.values(ghgTotal);
        total.sort((a, b) => {
            const order = [
                ...northDis,
                ...centralDis,
                ...southDis,
                ...easternDis,
                ...northTon,
                ...southTon
            ];
            const indexA = order.indexOf(a.amphures);
            const indexB = order.indexOf(b.amphures);

            if (indexA === -1) return 1;
            if (indexB === -1) return -1;

            return indexA - indexB;
            });
            res.render('Report-50-Districts.ejs', {
            count: 1,
            total: total,
            startDate: startDate,
            endDate: endDate,
            easternDis : easternDis,
            northDis : northDis,
            centralDis : centralDis,
            southDis : southDis,
            northTon : northTon,
            southTon : southTon,
			PublicSum : PubcustomerSum
        });


    } catch (err) {
        console.error('Error fetching data from API:', err);
        res.status(500).send('Error fetching data from API: ' + err.message);
    }
});


// SENT TO SERVER
app.get('/api/carbon-credit', async (req, res) => {
    const startDate = req.query.startDate || showDate();
    const endDate = req.query.endDate || showDate();


    try {
        const result = await axios.get(api + 'get_carbon_cal/search',
            { params: {
                startDate : startDate,
                endDate : endDate
            } });
        const carbonCal = result.data
        const combined = {};
        carbonCal.forEach(cal => {
            const key = cal.location;
            const date = new Date(cal.purchase_date);

            if (!combined[key]) {
                combined[key] = {
                    purchase_date : date.toLocaleDateString('th-TH',{
                        day : "numeric",
                        month : "short",
                        year : "numeric"
                    }),
                    customer_group : cal.customer_group,
                    location : cal.location,
                    tambons : cal.tambons,
                    amphures : cal.amphures,
                    provinces : cal.provinces,
                    kg_delivery : parseFloat(cal.kg_delivery) || 0,
                    total_delivery : parseFloat(cal.total_delivery) || 0,
                    ghg : carbonCalc(cal, 'item_name', 'kg_delivery') || 0,
                }
            } else {
                combined[key].kg_delivery += parseFloat(cal.kg_delivery) || 0;
                combined[key].total_delivery += parseFloat(cal.total_delivery) || 0;
                combined[key].ghg += carbonCalc(cal, 'item_name', 'kg_delivery') || 0;
            }
        });

        const totals = Object.values(combined);
        res.send(JSON.stringify({
            totals: totals,
            startDate: startDate,
            endDate: endDate
        }));
    } catch (err) {
        console.error('Error fetching data from API:', err);
        res.status(500).send('Error fetching data from API: ' + err.message);
    };

});


// SENT TO SERVER
app.get('/api/carbon-credit-material', async (req, res) => {
    const startDate = req.query.startDate || showDate();
    const endDate = req.query.endDate || showDate();

    try {
        const result = await axios.get(api + 'get_carbon_cal/search', {
            params: {
                startDate: startDate,
                endDate: endDate
            }
        });

        const carbonCal = result.data;
        const combined = {};
        carbonCal.forEach(cal => {
            const key = `${cal.location}_${cal.purchase_number}`;
            const date = new Date(cal.purchase_date);

            if (!combined[key]) {
                combined[key] = {
                    purchase_date: date.toLocaleDateString('th-TH', {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                    }),
                    purchase_number : cal.purchase_number,
                    customer_group: cal.customer_group,
                    location: cal.location,
                    category : cal.category,
                    item_name: cal.item_name,
                    amphures: cal.amphures,
                    provinces: cal.provinces,
                    kg_delivery: parseFloat(cal.kg_delivery) || 0,
                    total_delivery: parseFloat(cal.total_delivery) || 0,
                    ghg: parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0,
                };
            } else {
                combined[key].kg_delivery += parseFloat(cal.kg_delivery) || 0;
                combined[key].total_delivery += parseFloat(cal.total_delivery) || 0;
                combined[key].ghg += parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0;
            }
        });

        const totals = Object.values(combined);

        carbonCal.forEach(cal => {
            const key = `${cal.customer_group}_${cal.item_name}_${cal.purchase_number}`;
            const date = new Date(cal.purchase_date);

            if (!combined[key]) {
                combined[key] = {
                    purchase_date: date.toLocaleDateString('th-TH', {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                    }),
                    purchase_number : cal.purchase_number,
                    customer_group: cal.customer_group,
                    location: cal.location,
                    item_name: cal.item_name,
                    amphures: cal.amphures,
                    provinces: cal.provinces,
                    kg_delivery: parseFloat(cal.kg_delivery) || 0,
                    total_delivery: parseFloat(cal.total_delivery) || 0,
                    ghg: parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0,
                };
            } else {
                combined[key].kg_delivery += parseFloat(cal.kg_delivery) || 0;
                combined[key].total_delivery += parseFloat(cal.total_delivery) || 0;
                combined[key].ghg += parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0;
            }
        });
        const mattotals = Object.values(combined);
        res.json({
            mattotals : mattotals,
            totals: totals,
            startDate: startDate,
            endDate: endDate
        });
    } catch (err) {
        console.error('Error fetching data from API:', err);
        res.status(500).send('Error fetching data from API: ' + err.message);
    }
});


// CLIENT TO INTERFACE
app.get('/report-carbon-credit', async (req, res) => {
    const startDate = req.query.startDate || showDate();
    const endDate = req.query.endDate || showDate();
    const limit = parseInt(req.query.limit, 10) || 10000;
    const page = parseInt(req.query.page, 10) || 1;
    const amphures = req.query.amphures || [];
    try {
        const result = await axios.get(api + 'api-carbon-cal', {params : {
            startDate : startDate,
            endDate : endDate,
            limit : limit,
            page : page,
            amphures : amphures
        }});


        const pageData = result.data.data;
        const totalindex =  result.data.totalrecord
        const totalpage = Math.ceil( totalindex / limit)
        res.render('Report-Carbon-Credit.ejs', {
            count : ( page - 1) * limit + 1 ,
            totals : pageData,
            startDate : startDate,
            endDate : endDate,
            limit : limit,
            currentPage : page,
            totalPage : totalpage,
            amphures : amphures
        });
    } catch (err) {
        console.error('Error fetching data from API:', err);
        res.status(500).send('Error fetching data from API: ' + err.message);
    }

});

app.get('/report-customer-details-materials', async (req, res) => {
    const startDate = req.query.startDate || showDate();
    const endDate = req.query.endDate || showDate();
    const limit = parseInt(req.query.limit, 10) || 5000;
    const page = parseInt(req.query.page, 10) || 1;
    const customerGroup = req.query.customer_group || [];
    const inputStart = InStartDate(startDate) || InStartDate();
    const inputEnd = InEndDate(endDate) || InEndDate();

    const dayStart = String(inputStart[2]);
    const monthStart = String(inputStart[1]);
    const yearStart = String(inputStart[0]);

    const dayEnd = String(inputEnd[2]);
    const monthEnd = String(inputEnd[1]);
    const yearEnd = String(inputEnd[0]);


    try {
        const [result, material] = await Promise.all([
            axios.get( api + 'get_carbon_cal/search', { params : { startDate : startDate, endDate : endDate, customer_group : customerGroup}}),
            axios.get( api + 'api-carbon-cal-material', { params : { startDate : startDate , endDate : endDate, limit : limit, page : page, customer_group : customerGroup}})
        ]);

        const carbonCal = result.data;
        const materialCal = material.data.data;


        // CUSTOMER DATA
        const combined = {};
        carbonCal.forEach(cal => {
            const key = `${cal.customer_group}`;
            const date = new Date(cal.purchase_date);
            if (!combined[key]) {
                combined[key] = {
                    purchase_date : date.toLocaleDateString('th-TH',{
                        day : "numeric",
                        month : "short",
                        year : "numeric"
                    }),
                    purchase_number : cal.purchase_number,
                    customer_group : cal.customer_group,
                    location : cal.location,
                    amphures : cal.amphures,
                    provinces : cal.provinces,
                    kg_delivery : parseFloat(cal.kg_delivery) || 0,
                    total_delivery : parseFloat(cal.total_delivery) || 0,
                    ghg : parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0,
                };
            } else {
                combined[key].kg_delivery += parseFloat(cal.kg_delivery) || 0;
                combined[key].total_delivery += parseFloat(cal.total_delivery) || 0;
                combined[key].ghg += parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0;
            }
        });
        const totals = Object.values(combined);

        // SENT TO MODAL MATERIALS AND 4 CHART
        const combinedModal = {};
        carbonCal.forEach(cal => {
            const key = `${cal.customer_group} ${cal.location}`;
            const date = new Date(cal.purchase_date);
            const paper = cal.category === 'กระดาษ' ? parseFloat(cal.kg_delivery) || 0 : 0;
            const glass = cal.category === 'แก้ว' ? parseFloat(cal.kg_delivery) || 0 : 0;
            const plastic = cal.category === 'พลาสติก' ? parseFloat(cal.kg_delivery) || 0 : 0;
            const metal1 = cal.category === 'เหล็ก' ? parseFloat(cal.kg_delivery) || 0 : 0;
            const metal2 = cal.category === 'โลหะมีค่า' ? parseFloat(cal.kg_delivery) || 0 : 0;
            const oil = cal.category === 'น้ำมัน' ? parseFloat(cal.kg_delivery) || 0 : 0;
            const other = cal.category === 'เบ็ตเตล็ด' ? parseFloat(cal.kg_delivery) || 0 : 0;

            if (!combinedModal[key]) {
                combinedModal[key] = {
                    purchase_date : date.toLocaleDateString('th-TH',{
                        day : "numeric",
                        month : "short",
                        year : "numeric"
                    }),
                    purchase_number : cal.purchase_number,
                    customer_group : cal.customer_group,
                    location : cal.location,
                    paper : paper,
                    glass : glass,
                    plastic : plastic,
                    metal1 : metal1,
                    metal2 : metal2,
                    oil : oil,
                    other : other,
                    amphures : cal.amphures,
                    provinces : cal.provinces,
                    kg_delivery : parseFloat(cal.kg_delivery) || 0,
                    total_delivery : parseFloat(cal.total_delivery) || 0,
                    ghg : parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0,
                };
            } else {
                combinedModal[key].kg_delivery += parseFloat(cal.kg_delivery) || 0;
                combinedModal[key].total_delivery += parseFloat(cal.total_delivery) || 0;
                combinedModal[key].ghg += parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0;
                combinedModal[key].paper += paper;
                combinedModal[key].glass += glass;
                combinedModal[key].metal1 += metal1;
                combinedModal[key].metal2 += metal2;
                combinedModal[key].plastic += plastic;
                combinedModal[key].oil += oil;
                combinedModal[key].other += other;
            }
        });

        const modalMaterial = Object.values(combinedModal);

        // GROUP CUSTOMERS DATA
        const combinedGroup = {};
        carbonCal.forEach(cal => {
            const key = `${cal.location}_${cal.customer_group}`;
            const date = new Date(cal.purchase_date);
            if (!combinedGroup[key]) {
                combinedGroup[key] = {
                    purchase_date : date.toLocaleDateString('th-TH', {
                        day : "numeric",
                        month : "short",
                        year : "numeric"
                    }),
                    location : cal.location,
                    customer_group : cal.customer_group,
                    category : cal.category,
                    item_name : cal.item_name,
                    kg_delivery : parseFloat(cal.kg_delivery) || 0,
                    total_delivery : parseFloat(cal.total_delivery) || 0,
                    ghg : parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0
                }
            } else {
                combinedGroup[key].kg_delivery += parseFloat(cal.kg_delivery) || 0;
                combinedGroup[key].total_delivery += parseFloat(cal.total_delivery) || 0;
                combinedGroup[key].ghg += parseFloat(carbonCalc(cal, 'item_name' , 'kg_delivery')) || 0;
            }
        });

        const totalGroup = Object.values(combinedGroup);

        // GROUP MATERIALS
        const combinedGroupMat = {};
        carbonCal.forEach(cal => {
            const key = `${cal.category}_${cal.customer_group}`;
            const date = new Date(cal.purchase_date);
            if (!combinedGroupMat[key]) {
                combinedGroupMat[key] = {
                    purchase_date : date.toLocaleDateString('th-TH', {
                        day : "numeric",
                        month : "short",
                        year : "numeric"
                    }),
                    location : cal.location,
                    customer_group : cal.customer_group,
                    category : cal.category,
                    item_name : cal.item_name,
                    kg_delivery : parseFloat(cal.kg_delivery) || 0,
                    total_delivery : parseFloat(cal.total_delivery) || 0,
                    ghg : parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0
                }
            } else {
                combinedGroupMat[key].kg_delivery += parseFloat(cal.kg_delivery) || 0;
                combinedGroupMat[key].total_delivery += parseFloat(cal.total_delivery) || 0;
                combinedGroupMat[key].ghg += parseFloat(carbonCalc(cal, 'item_name' , 'kg_delivery')) || 0;
            }
        });

        const groupMat = Object.values(combinedGroupMat);

        // Group Customer Detail
        const combinedDetail = {};
        carbonCal.forEach(cal => {
            const key = `${cal.category}`;
            const date = new Date(cal.purchase_date);
            if (!combinedDetail[key]) {
                combinedDetail[key] = {
                    purchase_date : date.toLocaleDateString('th-TH', {
                        day : "numeric",
                        month : "short",
                        year : "numeric"
                    }),
                    location : cal.location,
                    customer_group : cal.customer_group,
                    category : cal.category,
                    item_name : cal.item_name,
                    kg_delivery : parseFloat(cal.kg_delivery) || 0,
                    total_delivery : parseFloat(cal.total_delivery) || 0,
                    ghg : parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0
                }
            } else {
                combinedDetail[key].kg_delivery += parseFloat(cal.kg_delivery) || 0;
                combinedDetail[key].total_delivery += parseFloat(cal.total_delivery) || 0;
                combinedDetail[key].ghg += parseFloat(carbonCalc(cal, 'item_name' , 'kg_delivery')) || 0;
            }
        });

        const matDetailGroup = Object.values(combinedDetail);

        const matDetail = material.data.matdata;
        const totalindex =  material.data.totalrecord
        const totalpage = Math.ceil( totalindex / limit)


        res.render('Report-Customer-Details-materials.ejs', {
            count : 1,
            count_sub : ( page - 1) * limit + 1 ,
            modalMaterial: modalMaterial,
            matDetailGroup: matDetailGroup,
            groupMat : groupMat,
            totalGroup : totalGroup,
            totals : totals,
            materialCal : materialCal,
            matDetail : matDetail,
            startDate : startDate,
            endDate : endDate,
            limit : limit,
            currentPage : page,
            totalPage : totalpage,
            customer_group : customerGroup
        });
    } catch (err) {
        console.error('Error fetching data from API:', err);
        res.status(500).send('Error fetching data from API: ' + err.message);
    };

});

//##############################  EXPORT FUATHER #####################################

// PDF


app.listen(port ,  () => {
    console.log(`listening on Port : ${port}`)
})
