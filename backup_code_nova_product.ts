import { knex } from '../controllers/database';
import * as Request from 'request';
import * as moment from 'moment-timezone';
import { ResponseHandler } from '../helpers/responsehandler';
import { authHandler } from '../auth'
const get = GetAxosProductsDetail();
import * as productResponse from '../models/product';
import request = require('request-promise');
const responseHandler = new ResponseHandler();
import { Promise } from 'bluebird';

/*
Returns an array of products the Account has paid/subscribed for
*/
export const productSummary = function (event, context, callback) {
    context.callbackWaitsForEmptyEventLoop = false;

    let cognitoIdentityId = event && event.requestContext && event.requestContext.identity && event.requestContext.identity.cognitoIdentityId ? event.requestContext.identity.cognitoIdentityId : null;
    console.log('Cognito Id received from mobile app is ' + cognitoIdentityId);
    if (!cognitoIdentityId || cognitoIdentityId == 'offlineContext_cognitoIdentityId') {
        console.log('Cognito Identity Id is null or auto gen by Serverless');
        //TODO: enabled this just for local dev purposes!
        cognitoIdentityId = 'ap-southeast-2:0a5488f1-d375-4bed-9017-47dd80cb94b9';
    }
    console.log('hard-coded cog id is: ' + cognitoIdentityId);

    //TODO: Validate whether user is registered (TEMP SOLUTION)
    authHandler(cognitoIdentityId).then(regReturn => {
        let errorResponse;
        if (regReturn === false) {
            let errorResponse = responseHandler.error(401, 'User not registerd', 'NotAuthorizedException');
            callback(null, errorResponse);
        }
        else {
            let products: any = [];
            let summaryReturn: any = [];
            knex.from('ICP__c')
                .innerJoin('Contact', 'AccountId', 'ICP__c.Account__c')
                .innerJoin('ContactRegister', 'Contact.Id', 'ContactRegister.ContactId')
                .where({ 'ContactRegister.CognitoIdentity': cognitoIdentityId })
                .select('ICP__c.Name', 'ICP__c.PDCT__c', 'ICP__c.Address_Formula__c', 'ICP__c.ToD_Billing_Enabled__c')
                .then(d => {
                    var mergedData = mergeSameAddressProducts(d);
                    getEachPremiseDetail(mergedData, cognitoIdentityId)
                        .then(summaryReturn => {
                            let response = responseHandler.success(summaryReturn);
                            callback(null, response);
                        })
                }).catch(e => {
                    console.log(e);
                    let serverErrorResponse = responseHandler.serverError(e);
                    callback(null, serverErrorResponse);
                }).finally(() => {
                })
        }
    })
}

function getEachPremiseDetail(knexData, cognitoIdentityId) {
    return Promise.map(knexData, function (element: any) {
        var singlePremise = new productResponse.SinglePremise();
        return Promise.map(element.Name, function (name, i) {
            var data = new productResponse.SingleProductData();
            var singleProduct = new productResponse.SingleProduct();
            singleProduct.Data = data;
            data = {
                Id: element.Name[i],
                IsTod: element.ToD_Billing_Enabled__c[i]
            }
            singleProduct = {
                ProductType: element.PDCT__c[i],
                Data: data
            }
            return (SetPowerDetail(singleProduct, cognitoIdentityId, singlePremise))
        }).then(products => {
            singlePremise = {
                "Address": element.Address_Formula__c,
                "Products": products
            };
            return singlePremise;
        })
    })
}

function SetPowerDetail(singleProduct, cognitoIdentityId, singlePremise) {
    let todBracket: any = [];

    if (singleProduct.ProductType == 'POWER' && (singleProduct.Data.IsTod === true)) {

        singleProduct.Data.Tod = todBracket;

        return knex.from('Account')
            .innerJoin('Contact', 'AccountId', 'Account.Id')
            .innerJoin('ContactRegister', 'Contact.Id', 'ContactRegister.ContactId')
            .where({ 'ContactRegister.CognitoIdentity': cognitoIdentityId })
            .select('Account.Party_Code__c as saleForceAccNum')
            .then(d => {
                let invoiceableId: number;
                let contractedIcpsId: number;
                let sFAccNum = d[0].saleForceAccNum;
                if (typeof sFAccNum == 'undefined') {
                    return singleProduct;
                    //TODO: hardcoded saleforce account number just for dev purpose
                    // console.log("saleForceAccNum:" + sFAccNum + ", hard code it as 233904 for now.");
                    // sFAccNum = 233904;
                }

                return get('/api/v1.0/accounts?filter[account_number]=' + sFAccNum)
                    .then(res => {
                        return res.data[0].id;
                    })
                    .then(accountId => get('/api/v1.0/accounts/' + accountId + '/invoiceables'))
                    .then(res => res.data[0].id)
                    .then(invoiceId => {
                        invoiceableId = invoiceId;
                        return get('/api/v1.0/invoiceables/' + invoiceableId + '/contracted_icps');
                    })
                    .then(d => {
                        contractedIcpsId = d.data[0].id
                        return get('/api/v1.0/invoiceables/' + invoiceableId + '/contracted_icps' + '/' + contractedIcpsId)
                    })
                    .then(d => {
                        contractedIcpsId = d.data.id;

                        //TODO: When AXOS API data ready, replace the startDate and endDate to send request based on current month.
                        // let today = new Date();
                        // let startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                        // let endDate = convertDate(new Date());

                        //TODO: currently hardcode startDate and endDate to get available AXOS API data
                        let startDate = "2017-10-01";
                        let endDate = "2017-10-31";

                        return get('/api/v1.0/invoiceables/' + invoiceableId + '/contracted_icps' + '/' + contractedIcpsId +
                            '/time_of_day_summary?filter[start_date]=' + startDate + '&filter[end_date]=' + endDate + '&filter[day_type]=ALL')
                    })
                    .then(d => {
                        singleProduct.Data.CurrentUsage = parseFloat(d.data[0].measured[0].sum_cost);
                        singleProduct.Data.UsageAsAt = d.data[0].summary.last_measured_at;
                        singleProduct.Data.EstimatedUsage = parseFloat(d.data[0].forecast[0].sum_cost);
                        let startDate = moment().tz("Pacific/Auckland").format("YYYY-MM-DD");
                        let endDate = moment().tz("Pacific/Auckland").format("YYYY-MM-DD");
                        return get('/api/v1.0/invoiceables/' + invoiceableId + '/contracted_icps' + '/' + contractedIcpsId +
                            '/tariff_collection_pricing_summary?filter[start_date]=' + startDate + '&filter[end_date]=' + endDate)

                    }).then(d => {
                        d.data.map(item => {
                            let singleTod = new productResponse.SingleTodBracket();
                            singleTod.Bracket = item.collection_type;
                            singleTod.Start = item.starts_at;
                            singleTod.End = item.ends_before;
                            singleTod.StartSec = moment(item.starts_at).diff(moment(), 'seconds');
                            singleTod.EndSec = moment(item.ends_before).diff(moment(), 'seconds');
                            todBracket.push(singleTod);
                        });
                        return (singleProduct);
                    })
            })

    } else {
        return (singleProduct);
    }
}

function GetAxosProductsDetail() {
    const get = url => request.get({
        url: process.env.AXOS_SERVER + url,
        headers: {
            Accept: 'application/json',
            //TODO: use token from environment value
            Authorization: process.env.AXOS_AUTHORISATION,
            'Content-Type': 'application/json'
        }
    }).then(JSON.parse)
        .catch(e => {
            console.log('Error occured in GetAxosProductsDetail: ' + e);
        });
    return get;
}

//Made this redundant as we can use momentjs (Lilupa)
function convertDate(date) {
    var yyyy = date.getFullYear().toString();
    var mm = (date.getMonth() + 1).toString();
    var dd = date.getDate().toString();
    var mmChars = mm.split('');
    var ddChars = dd.split('');
    var datestring = yyyy + '-' + (mmChars[1] ? mm : "0" + mmChars[0]) + '-' + (ddChars[1] ? dd : "0" + ddChars[0]);
    return datestring;
}

function mergeSameAddressProducts(inputArray) {
    let output: any = [];
    inputArray.forEach(function (element) {
        var existing = output.filter(function (v, i) {
            return v.Address_Formula__c == element.Address_Formula__c;
        });
        if (existing.length) {
            var existingIndex = output.indexOf(existing[0]);
            output[existingIndex].PDCT__c = output[existingIndex].PDCT__c.concat(element.PDCT__c);
            output[existingIndex].Name = output[existingIndex].Name.concat(element.Name);
            output[existingIndex].ToD_Billing_Enabled__c = output[existingIndex].ToD_Billing_Enabled__c.concat(element.ToD_Billing_Enabled__c);
        } else {
            if (typeof element.PDCT__c == 'string')
                element.PDCT__c = [element.PDCT__c];
            element.Name = [element.Name];
            element.ToD_Billing_Enabled__c = [element.ToD_Billing_Enabled__c];
            output.push(element);
        }
    });

    return output;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
export const productDetails = function (event, context, callback) {
    context.callbackWaitsForEmptyEventLoop = false;

    let cognitoIdentityId = event && event.requestContext && event.requestContext.identity && event.requestContext.identity.cognitoIdentityId ? event.requestContext.identity.cognitoIdentityId : null;
    console.log('Cognito Id received from mobile app is ' + cognitoIdentityId);
    if (!cognitoIdentityId || cognitoIdentityId == 'offlineContext_cognitoIdentityId') {
        console.log('Cognito Identity Id is null or auto gen by Serverless');
        //TODO: enabled this just for local dev purposes!
        cognitoIdentityId = 'ap-southeast-2:6b61cab8-fc23-46cc-bf1b-3c63f408b708';
        console.log('hard-coded cog id is: ' + cognitoIdentityId);
    }
    //TODO: Validate whether user is registered (TEMP SOLUTION)
    authHandler(cognitoIdentityId).then(regReturn => {
        let errorResponse;
        if (regReturn === false) {
            let errorResponse = responseHandler.error(401, 'User not registerd', 'NotAuthorizedException');
            callback(null, errorResponse);
        }
        else {

            let pathParams = event.pathParameters;

            if (!pathParams || !(pathParams.type == 'power' || pathParams.type == 'gas') || pathParams.id === null) {
                let errorResponse = responseHandler.error(400, "Invalid data", "BadRequest");
                callback(null, errorResponse);
            }
            else {
                let pd = new productResponse.ProductDetail();
                pd.Today = new Date(1970, 0, 1, 9, 30);
                pd.CurrentUsage = undefined;
                pd.UsageAsAt = undefined;
                pd.LastMonthsUsage = undefined;
                pd.EstimatedUsage = undefined;
                let todDetail = new productResponse.TodDetail();
                let UsageSummaryDetail = new productResponse.UsageSummaryDetail();
                let todBracket: any = [];
                let currentMonthBracket: any = [];
                let priorMonthBracket: any = [];
                let halfHourlyAverageDetail: any = [];
                let monthlyUsage: any = [];
                let dailyUsage: any = [];
                let currentMonthDetail = new productResponse.MonthDetail();
                let priorMonthDetail = new productResponse.MonthDetail();
                pd.MonthlyUsage = monthlyUsage;
                todDetail.Savings = 0;
                todDetail.SavingsToDate = 0;
                todDetail.Brackets = todBracket;
                todDetail.UsageSummary = UsageSummaryDetail;
                UsageSummaryDetail.CurrentMonth = currentMonthDetail;
                UsageSummaryDetail.PriorMonth = priorMonthDetail;
                currentMonthDetail.Brackets = currentMonthBracket;
                priorMonthDetail.Brackets = priorMonthBracket;
                todDetail.HalfHourlyAverage = halfHourlyAverageDetail;
                let paramInput;
                GetICPDetail(pathParams, cognitoIdentityId)
                    .then(d => {
                        if (typeof d == 'undefined') {
                            let serverErrorResponse = responseHandler.serverError("No data found for the ICP_Num");
                            callback(null, serverErrorResponse);
                        } else {
                            if (pathParams.type == 'power') {
                                pd.DailyUsage = dailyUsage;
                                pd.Tod = todDetail;
                                return GetRequiredAxosParameters(cognitoIdentityId)
                                    .then(d => {
                                        pd.Today = new Date(moment().tz("Pacific/Auckland").format("YYYY-MM-DD"));
                                        paramInput = d;
                                        return GetUsageAsAtAndCurrentUsage(paramInput);
                                    })
                                    .then(d => {
                                        pd.UsageAsAt = new Date(d.data[0].summary.last_measured_at);
                                        pd.CurrentUsage = Number(d.data[0].measured[0].sum_cost);
                                        pd.EstimatedUsage = Number(d.data[0].forecast[0].sum_cost);
                                        return getLastMonthUsage(paramInput);
                                    })
                                    .then(d => {
                                        pd.LastMonthsUsage = Number(d.data[0].measured[0].sum_cost);
                                        return getMonthlyUsage(paramInput);
                                    })
                                    .then(d => {
                                        var array = Object.keys(d.data.attributes.usage).map(key => ({
                                            Date: key, Unit: d.data.attributes.usage[key]
                                        }));
                                        return Promise.map(array, item => {
                                            let singleMonthlyUsage = new productResponse.SingleUsage();
                                            singleMonthlyUsage.Date = moment(item.Date).add(1, "day").toDate();
                                            singleMonthlyUsage.Units = item.Unit;
                                            monthlyUsage.push(singleMonthlyUsage);
                                        });

                                    })
                                    .then(d => {
                                        return getDailyUsage(paramInput);

                                    })
                                    .then(d => {
                                        //As per the clarification came from Axos (Lissette)
                                        //Need to sum all the data of units with same dates where flow_type == "X"
                                        
                                        var groupedresult = groupBy(d.data, function (item) {
                                            return [item.period_date];
                                        });
                                        groupedresult.forEach(element => {
                                            let singleMonthlyUsage = new productResponse.SingleUsage();
                                            let sumUnit: number = 0;
                                            element.forEach(i => {
                                                singleMonthlyUsage.Date = moment(new Date(i.period_date)).toDate();
                                                if (i.data_stream.flow_type === "X") {
                                                    i.interval_values.forEach(k => {
                                                        let singleUnit = parseFloat(k);
                                                        sumUnit = Math.round((sumUnit + singleUnit) * 100) / 100;
                                                    });
                                                }
                                                
                                            });
                                            singleMonthlyUsage.Units = sumUnit;
                                            dailyUsage.push(singleMonthlyUsage);
                                        });
                                        // return Promise.map(d.data, function (item: any) {
                                        //     let singleMonthlyUsage = new productResponse.SingleUsage();
                                        //     singleMonthlyUsage.Date = moment(new Date(item.period_date)).toDate();
                                        //     let sumUnit: number = 0;
                                        //     return Promise.map(item.interval_values, function (singleIntervalValue: any) {
                                        //         let singleUnit = parseFloat(singleIntervalValue);
                                        //         sumUnit = Math.round((sumUnit + singleUnit) * 100) / 100;
                                        //     }).then(() => {
                                        //         singleMonthlyUsage.Units = sumUnit;
                                        //         dailyUsage.push(singleMonthlyUsage);
                                        //     })
                                        // });
                                    })
                                    .then(d => {
                                        return getInvoicesId(paramInput);
                                    })
                                    .then(d => {
                                        let latestInvoiceDate = new Date(Math.max.apply(null, d.data.map(function (i) {
                                            return new Date(i.attributes.billing_end_date);
                                        })));
                                        let latestInvoiceId: number = 0;
                                        d.data.map(function (i) {
                                            if (new Date(i.attributes.billing_end_date).getTime() === latestInvoiceDate.getTime()) {
                                                latestInvoiceId = i.id;
                                            }
                                        });
                                        return latestInvoiceId;
                                    })
                                    .then(latestInvoiceId => {
                                        return getSavings(paramInput, latestInvoiceId);
                                    })
                                    .then(d => {
                                        todDetail.Savings = d.data[0].attributes.plan_savings_invoice;
                                        todDetail.SavingsToDate = d.data[0].attributes.plan_savings_year;
                                        return getTodBracket(paramInput);
                                    })
                                    .then(d => {
                                        d.data.map(item => {
                                            let singleTod = new productResponse.SingleTodBracket();
                                            singleTod.Bracket = item.collection_type;
                                            singleTod.Start = item.starts_at;
                                            singleTod.End = item.ends_before;
                                            singleTod.StartSec = moment(item.starts_at).diff(moment(), 'seconds');
                                            singleTod.EndSec = moment(item.ends_before).diff(moment(), 'seconds');
                                            todBracket.push(singleTod);
                                        });
                                    })
                                    .then(d => {
                                        //get current month usage
                                        let startDate = moment().tz("Pacific/Auckland").startOf('month').format("YYYY-MM-DD");
                                        let endDate = moment().tz("Pacific/Auckland").format("YYYY-MM-DD");
                                        return getTodDetail(paramInput, startDate, endDate);
                                    })
                                    .then(d => {
                                        MapMonthBracket(d, currentMonthBracket);
                                        //Get Prior month usage
                                        let startDate = moment().tz("Pacific/Auckland").subtract(1, 'months').startOf('month').format("YYYY-MM-DD");
                                        let endDate = moment().tz("Pacific/Auckland").subtract(1, 'months').endOf('month').format("YYYY-MM-DD");
                                        return getTodDetail(paramInput, startDate, endDate);
                                    })
                                    .then(d => {
                                        MapMonthBracket(d, priorMonthBracket);
                                        let startDate = moment().tz("Pacific/Auckland").startOf('month').format("YYYY-MM-DD");
                                        let endDate = moment().tz("Pacific/Auckland").format("YYYY-MM-DD");
                                        return getTodDetail(paramInput, startDate, endDate)
                                    })
                                    .then(d => {
                                        MapHalfHourlyAverageDetail(d, halfHourlyAverageDetail);
                                    })
                                    .finally(() => {

                                        let response = responseHandler.success(pd);
                                        callback(null, response);
                                    })
                                    .catch(e => {
                                        console.log(e)
                                        let serverErrorResponse = responseHandler.serverError(e);
                                        callback(null, serverErrorResponse);
                                    })
                            } else {
                                return GetRequiredAxosParameters(cognitoIdentityId)
                                    .then(d => {
                                        pd.Today = new Date(moment().tz("Pacific/Auckland").format("YYYY-MM-DD"));
                                        paramInput = d;
                                        return getLastMonthUsage(paramInput);
                                    })
                                    .then(d => {
                                        pd.LastMonthsUsage = Number(d.data[0].measured[0].sum_cost);
                                        return getMonthlyUsage(paramInput);
                                    })
                                    .then(d => {
                                        console.log(JSON.stringify(d))
                                        var array = Object.keys(d.data.attributes.usage).map(key => ({
                                            Date: key, Unit: d.data.attributes.usage[key]
                                        }));
                                        return Promise.map(array, item => {
                                            let singleMonthlyUsage = new productResponse.SingleUsage();
                                            singleMonthlyUsage.Date = moment(item.Date).add(1, "day").toDate();
                                            singleMonthlyUsage.Units = item.Unit;
                                            monthlyUsage.push(singleMonthlyUsage);
                                        });

                                    })
                                    .finally(() => {

                                        let response = responseHandler.success(pd);
                                        callback(null, response);
                                    })
                                    .catch(e => {
                                        console.log(e)
                                        let serverErrorResponse = responseHandler.serverError(e);
                                        callback(null, serverErrorResponse);
                                    })
                            }
                        }
                        console.log(JSON.stringify(d));
                    }).catch(e => {

                        let serverErrorResponse = responseHandler.serverError(e);
                        callback(null, serverErrorResponse);
                    })
            }


        }
    })
}
function MapHalfHourlyAverageDetail(d: any, halfHourlyAverageDetail: any) {
    var groupedresult = groupBy(d.data, function (item) {
        return [item.collection_type];
    });
    let shoulderArray: any = [];
    let offPeakArray: any = [];
    let peakArray: any = [];
    groupedresult.forEach(element => {
        if (element[0].collection_type === "Shoulder") {
            shoulderArray = element;
        }
        else if (element[0].collection_type === "OffPeak") {
            offPeakArray = element;
        }
        else if (element[0].collection_type === "Peak") {
            peakArray = element;
        }
    });
    var groupedshoulder = groupBy(shoulderArray, function (item) {
        return [item.start_time];
    });
    var groupedoffPeak = groupBy(offPeakArray, function (item) {
        return [item.start_time];
    });
    var groupedPeak = groupBy(peakArray, function (item) {
        return [item.start_time];
    });
    groupedshoulder.forEach(singleTimeInterval => {
        if (singleTimeInterval[0].tp != "99") {
            let singleHHA = new productResponse.SingleHalfHourlyAverageDetail();
            singleHHA.Time = singleTimeInterval[0].start_time;
            singleHHA.Bracket = singleTimeInterval[0].collection_type;
            singleHHA.Units = 0;
            singleTimeInterval.forEach(element => {
                singleHHA.Units += Number(element.avg_kwh);
            });
            halfHourlyAverageDetail.push(singleHHA);
        }
    });
    groupedoffPeak.forEach(singleTimeInterval => {
        if (singleTimeInterval[0].tp != "99") {
            let singleHHA = new productResponse.SingleHalfHourlyAverageDetail();
            singleHHA.Time = singleTimeInterval[0].start_time;
            singleHHA.Bracket = singleTimeInterval[0].collection_type;
            singleHHA.Units = 0;
            singleTimeInterval.forEach(element => {
                singleHHA.Units += Number(element.avg_kwh);
            });
            halfHourlyAverageDetail.push(singleHHA);
        }
    });
    groupedPeak.forEach(singleTimeInterval => {
        if (singleTimeInterval[0].tp != "99") {
            let singleHHA = new productResponse.SingleHalfHourlyAverageDetail();
            singleHHA.Time = singleTimeInterval[0].start_time;
            singleHHA.Bracket = singleTimeInterval[0].collection_type;
            singleHHA.Units = 0;
            singleTimeInterval.forEach(element => {
                singleHHA.Units += Number(element.avg_kwh);
            });
            halfHourlyAverageDetail.push(singleHHA);
        }
    });
}

function groupBy(array, f) {
    var groups = {};
    array.forEach(function (o) {
        var group = JSON.stringify(f(o));
        groups[group] = groups[group] || [];
        groups[group].push(o);
    });
    return Object.keys(groups).map(function (group) {
        return groups[group];
    })
}

function getTodDetail(params, start, end) {
    let invoiceableId = params.invoiceableId;
    let contractedIcpsId = params.contractedIcpsId;
    let startDate = start;
    let endDate = end;
    return get('/api/v1.0/invoiceables/' + invoiceableId + '/contracted_icps' + '/' + contractedIcpsId +
        '/time_of_day_detail?filter[start_date]=' + startDate + '&filter[end_date]=' + endDate)

}
function getTodBracket(params) {
    let invoiceableId = params.invoiceableId;
    let contractedIcpsId = params.contractedIcpsId;
    let startDate = moment().tz("Pacific/Auckland").format("YYYY-MM-DD");
    let endDate = moment().tz("Pacific/Auckland").format("YYYY-MM-DD");
    return get('/api/v1.0/invoiceables/' + invoiceableId + '/contracted_icps' + '/' + contractedIcpsId +
        '/tariff_collection_pricing_summary?filter[start_date]=' + startDate + '&filter[end_date]=' + endDate)

}
function getSavings(params, latestInvoiceId) {
    let invoiceableId = params.invoiceableId;
    return get('/api/v1.0/invoiceables/' + invoiceableId + '/invoices/' + latestInvoiceId + '/savings')
}
function getInvoicesId(params) {
    let invoiceableId = params.invoiceableId;
    return get('/api/v1.0/invoiceables/' + invoiceableId + '/invoices')
}
function getDailyUsage(params) {
    let invoiceableId = params.invoiceableId;
    let contractedIcpsId = params.contractedIcpsId;
    let startDate = moment().tz("Pacific/Auckland").startOf('month').format('YYYY-MM-DD');
    let endDate = moment().tz("Pacific/Auckland").format('YYYY-MM-DD');
    return get('/api/v1.0/invoiceables/' + invoiceableId + '/contracted_icps' + '/' + contractedIcpsId +
        '/hhr_volumes?filter[start_date]=' + startDate + '&filter[end_date]=' + endDate + '&filter[day_type]=ALL')
}
function getMonthlyUsage(params) {
    let invoiceableId = params.invoiceableId;
    let contractedIcpsId = params.contractedIcpsId;

    return get('/api/v1.0/invoiceables/' + invoiceableId + '/contracted_icps' + '/' + contractedIcpsId +
        '/monthly_volumes')
}
function getLastMonthUsage(params) {
    let invoiceableId = params.invoiceableId;
    let contractedIcpsId = params.contractedIcpsId;
    let startDate = moment().tz("Pacific/Auckland").subtract(1, 'months').startOf('month').format('YYYY-MM-DD');
    let endDate = moment().tz("Pacific/Auckland").subtract(1, 'months').endOf('month').format('YYYY-MM-DD');
    console.log("Last month usage Start:" + startDate + "; End:" + endDate)
    return get('/api/v1.0/invoiceables/' + invoiceableId + '/contracted_icps' + '/' + contractedIcpsId +
        '/time_of_day_summary?filter[start_date]=' + startDate + '&filter[end_date]=' + endDate + '&filter[day_type]=ALL')
}
function GetUsageAsAtAndCurrentUsage(params) {
    let invoiceableId = params.invoiceableId;
    let contractedIcpsId = params.contractedIcpsId;
    let startDate = moment().tz("Pacific/Auckland").startOf('month').format('YYYY-MM-DD');
    let endDate = moment().tz("Pacific/Auckland").format('YYYY-MM-DD');
    console.log("Current usage Start:" + startDate + "; End:" + endDate)
    return get('/api/v1.0/invoiceables/' + invoiceableId + '/contracted_icps' + '/' + contractedIcpsId +
        '/time_of_day_summary?filter[start_date]=' + startDate + '&filter[end_date]=' + endDate + '&filter[day_type]=ALL')

}

function GetICPDetail(pathParams, cognitoIdentityId) {
    console.log("Params pass in:" + JSON.stringify(pathParams));
    return knex.from('ICP__c')
        .innerJoin('Contact', 'AccountId', 'ICP__c.Account__c')
        .innerJoin('ContactRegister', 'Contact.Id', 'ContactRegister.ContactId')
        .where({ 'ContactRegister.CognitoIdentity': cognitoIdentityId, 'ICP__c.Name': pathParams.id })
        .select('ICP__c.Name', 'ICP__c.PDCT__c', 'ICP__c.Address_Formula__c', 'ICP__c.ToD_Billing_Enabled__c')
}
function GetRequiredAxosParameters(cognitoIdentityId) {

    return knex.from('Account')
        .innerJoin('Contact', 'AccountId', 'Account.Id')
        .innerJoin('ContactRegister', 'Contact.Id', 'ContactRegister.ContactId')
        .where({ 'ContactRegister.CognitoIdentity': cognitoIdentityId })
        .select('Account.Party_Code__c as saleForceAccNum')
        .then(d => {
            console.log("SF Num from DB:" + JSON.stringify(d))
            let accountId: number;
            let invoiceableId: number;
            let contractedIcpsId: number;
            let sFAccNum = d[0].saleForceAccNum;
            if (typeof sFAccNum == 'undefined') {
                //TODO: hardcoded saleforce account number just for dev purpose
                console.log("saleForceAccNum:" + sFAccNum + ", hard code it as 233904 for now.");
                sFAccNum = 233904;
            }
            //TODO: For Dev purpose - Returned data d is 280900 which has no data for account id when call, 
            //hard code it to 233904 
            sFAccNum = 233904;

            return get('/api/v1.0/accounts?filter[account_number]=' + sFAccNum)
                .then(res => {
                    return res.data[0].id;
                })
                .then(accId => {
                    accountId = accId;
                    return get('/api/v1.0/accounts/' + accId + '/invoiceables')
                })
                .then(res => res.data[0].id)
                .then(invoiceId => {
                    invoiceableId = invoiceId;
                    return get('/api/v1.0/invoiceables/' + invoiceableId + '/contracted_icps');
                })
                .then(d => {
                    contractedIcpsId = d.data[0].id
                    return get('/api/v1.0/invoiceables/' + invoiceableId + '/contracted_icps' + '/' + contractedIcpsId)
                })
                .then(d => {
                    contractedIcpsId = d.data.id;
                    let requiredParams: any;
                    requiredParams = {
                        "accountId": accountId,
                        "invoiceableId": invoiceableId,
                        "contractedIcpsId": contractedIcpsId,
                        "sFAccNum": sFAccNum
                    }
                    return requiredParams;

                }).catch(e => {

                    console.log("Error occurred in GetRequiredAxosParameters():");
                    console.log(e);
                })

        })
}

function MapMonthBracket(d: any, currentMonthBracket: any) {
    let shoulderArray: any = [];
    let offPeakArray: any = [];
    let peakArray: any = [];
    d.data.map(function (i) {
        if (i.tp === 99 && i.collection_type === "Shoulder") {
            let singleUnit = i.sum_kwh;
            shoulderArray.push(singleUnit);
        }
        if (i.tp === 99 && i.collection_type === "OffPeak") {
            let singleUnit = i.sum_kwh;
            offPeakArray.push(singleUnit);
        }
        if (i.tp === 99 && i.collection_type === "Peak") {
            let singleUnit = i.sum_kwh;
            peakArray.push(singleUnit);
        }
    });
    let totalShoulder: number = 0;
    let totalOffPeak: number = 0;
    let totalPeak: number = 0;
    for (var i in shoulderArray) {
        totalShoulder += Number(shoulderArray[i]);
    }
    for (var i in offPeakArray) {
        totalOffPeak += Number(offPeakArray[i]);
    }
    for (var i in peakArray) {
        totalPeak += Number(peakArray[i]);
    }
    let shoulderBracket = new productResponse.SingleBracketDetail();
    let offPeakBracket = new productResponse.SingleBracketDetail();
    let peakBracket = new productResponse.SingleBracketDetail();
    shoulderBracket.Bracket = "shoulder";
    offPeakBracket.Bracket = "off_peak";
    peakBracket.Bracket = "peak";
    shoulderBracket.Units = totalShoulder;
    offPeakBracket.Units = totalOffPeak;
    peakBracket.Units = totalPeak;
    currentMonthBracket.push(offPeakBracket);
    currentMonthBracket.push(shoulderBracket);
    currentMonthBracket.push(peakBracket);
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////

function mockPowerProductDetails(productId) {
    let powerProduct: any;
    if (productId == '123456') {
        powerProduct = {
            "Today": "2017-11-13",
            "CurrentUsage": 50.68,
            "UsageAsAt": "2017-12-16T11:00:00Z",
            "LastMonthsUsage": 47.98,
            "MonthlyUsage": [
                { "Date": "2015-11-01", "Units": 159 },
                { "Date": "2015-12-01", "Units": 180 },
                { "Date": "2016-01-01", "Units": 166 },
                { "Date": "2017-10-01", "Units": 122 },
            ],
            "DailyUsage": [
                { "Date": "2017-10-01", "Units": 23 },
                { "Date": "2017-10-02", "Units": 19 },
                { "Date": "2017-10-03", "Units": 16 },
                { "Date": "2017-10-31", "Units": 14 },
            ],
            "Tod": {
                "Savings": 5.60,
                "SavingsToDate": 4.40,
                "Brackets": [
                    { "Bracket": "Shoulder", "Start": "2017-10-23T21:00:00Z", "StartSec": -1250, "End": "2017-10-24T04:59:59Z", "EndSec": 21600 },
                    { "Bracket": "Peak", "Start": "2017-10-24T04:00:00Z", "StartSec": 21600, "End": "2017-10-24T06:59:59Z", "EndSec": 32400 },
                    { "Bracket": "Shoulder", "Start": "2017-10-24T07:00:00Z", "StartSec": 32400, "End": "2017-10-24T09:59:59Z", "EndSec": 43200 },
                    { "Bracket": "OffPeak", "Start": "2017-10-24T10:00:00Z", "StartSec": 43200, "End": "2017-10-24T17:59:59Z", "EndSec": 68400 }
                ],
                "UsageSummary": {
                    "CurrentMonth": [
                        { "Bracket": "OffPeak", "Units": 3.3 },
                        { "Bracket": "Shoulder", "Units": 4.4 },
                        { "Bracket": "Peak", "Units": 5.5 }
                    ],
                    "PriorMonth": [
                        { "Bracket": "OffPeak", "Units": 40.1 },
                        { "Bracket": "Shoulder", "Units": 50.2 },
                        { "Bracket": "Peak", "Units": 25.3 }
                    ]
                }
            },
            "HalfHourlyAverage": [
                { "Time": "00:00", "Bracket": "OffPeak", "Units": 2.0 },
                { "Time": "00:30", "Bracket": "OffPeak", "Units": 3.2 },
                { "Time": "01:00", "Bracket": "Shoulder", "Units": 0.2 },
                { "Time": "23:30", "Bracket": "OffPeak", "Units": 0.1 }
            ]
        }
    }
    else if (productId == '0000035188WEAF1') {
        powerProduct = {
            "Today": "2017-12-04",
            "LastMonthUsage": 23.78,
            "CurrentUsage": 45.89,
            "UsageAsAt": "2017-12-04T13:00:00Z",
            "MonthlyUsage": [
                {
                    "Date": "2015-12-01",
                    "Units": 110
                },
                {
                    "Date": "2016-01-01",
                    "Units": 115
                },
                {
                    "Date": "2016-02-01",
                    "Units": 120
                },
                {
                    "Date": "2016-03-01",
                    "Units": 125
                },
                {
                    "Date": "2016-04-01",
                    "Units": 120
                },
                {
                    "Date": "2016-05-01",
                    "Units": 118
                },
                {
                    "Date": "2016-06-01",
                    "Units": 121
                },
                {
                    "Date": "2016-07-01",
                    "Units": 122
                },
                {
                    "Date": "2016-08-01",
                    "Units": 130
                },
                {
                    "Date": "2016-09-01",
                    "Units": 140
                },
                {
                    "Date": "2016-10-01",
                    "Units": 130
                },
                {
                    "Date": "2016-11-01",
                    "Units": 129
                },
                {
                    "Date": "2016-12-01",
                    "Units": 128
                },
                {
                    "Date": "2017-01-01",
                    "Units": 122
                },
                {
                    "Date": "2017-02-01",
                    "Units": 120
                },
                {
                    "Date": "2017-03-01",
                    "Units": 110
                },
                {
                    "Date": "2017-04-01",
                    "Units": 112
                },
                {
                    "Date": "2017-05-01",
                    "Units": 118
                },
                {
                    "Date": "2017-06-01",
                    "Units": 130
                },
                {
                    "Date": "2017-07-01",
                    "Units": 133
                },
                {
                    "Date": "2017-08-01",
                    "Units": 120
                },
                {
                    "Date": "2017-09-01",
                    "Units": 135
                },
                {
                    "Date": "2017-10-01",
                    "Units": 127
                },
                {
                    "Date": "2017-11-01",
                    "Units": 100
                },
                {
                    "Date": "2017-12-01",
                    "Units": 45.89
                }
            ],
            "DailyUsage": [
                {
                    "Date": "2017-12-01",
                    "Units": 23
                },
                {
                    "Date": "2017-12-02",
                    "Units": 19
                },
                {
                    "Date": "2017-12-03",
                    "Units": 16
                }
            ],
            "Tod": {
                "HalfHourlyAverage": [
                    {
                        "Time": "00:00",
                        "Bracket": "OffPeak",
                        "Units": 0.6
                    },
                    {
                        "Time": "00:30",
                        "Bracket": "OffPeak",
                        "Units": 0.5
                    },
                    {
                        "Time": "01:00",
                        "Bracket": "OffPeak",
                        "Units": 0.4
                    },
                    {
                        "Time": "01:30",
                        "Bracket": "OffPeak",
                        "Units": 0.3
                    },
                    {
                        "Time": "02:00",
                        "Bracket": "OffPeak",
                        "Units": 0.2
                    },
                    {
                        "Time": "02:30",
                        "Bracket": "OffPeak",
                        "Units": 0.2
                    },
                    {
                        "Time": "03:00",
                        "Bracket": "OffPeak",
                        "Units": 0.2
                    },
                    {
                        "Time": "03:30",
                        "Bracket": "OffPeak",
                        "Units": 0.2
                    },
                    {
                        "Time": "04:00",
                        "Bracket": "OffPeak",
                        "Units": 0.1
                    },
                    {
                        "Time": "04:30",
                        "Bracket": "OffPeak",
                        "Units": 0.1
                    },
                    {
                        "Time": "05:00",
                        "Bracket": "Shoulder",
                        "Units": 0.2
                    },
                    {
                        "Time": "05:30",
                        "Bracket": "Shoulder",
                        "Units": 0.2
                    },
                    {
                        "Time": "06:00",
                        "Bracket": "Shoulder",
                        "Units": 0.3
                    },
                    {
                        "Time": "06:30",
                        "Bracket": "Peak",
                        "Units": 0.4
                    },
                    {
                        "Time": "07:00",
                        "Bracket": "Peak",
                        "Units": 0.7
                    },
                    {
                        "Time": "07:30",
                        "Bracket": "Peak",
                        "Units": 1.0
                    },
                    {
                        "Time": "08:00",
                        "Bracket": "Peak",
                        "Units": 0.8
                    },
                    {
                        "Time": "08:30",
                        "Bracket": "Shoulder",
                        "Units": 0.7
                    },
                    {
                        "Time": "09:00",
                        "Bracket": "Shoulder",
                        "Units": 0.6
                    },
                    {
                        "Time": "09:30",
                        "Bracket": "Shoulder",
                        "Units": 0.5
                    },
                    {
                        "Time": "10:00",
                        "Bracket": "Shoulder",
                        "Units": 0.6
                    },
                    {
                        "Time": "10:30",
                        "Bracket": "OffPeak",
                        "Units": 0.7
                    },
                    {
                        "Time": "11:00",
                        "Bracket": "OffPeak",
                        "Units": 1.0
                    },
                    {
                        "Time": "11:30",
                        "Bracket": "OffPeak",
                        "Units": 1.1
                    },
                    {
                        "Time": "12:00",
                        "Bracket": "OffPeak",
                        "Units": 0.8
                    },
                    {
                        "Time": "12:30",
                        "Bracket": "OffPeak",
                        "Units": 0.7
                    },
                    {
                        "Time": "13:00",
                        "Bracket": "OffPeak",
                        "Units": 0.6
                    },
                    {
                        "Time": "13:30",
                        "Bracket": "OffPeak",
                        "Units": 0.6
                    },
                    {
                        "Time": "14:00",
                        "Bracket": "OffPeak",
                        "Units": 0.6
                    },
                    {
                        "Time": "14:30",
                        "Bracket": "OffPeak",
                        "Units": 0.4
                    },
                    {
                        "Time": "15:00",
                        "Bracket": "Shoulder",
                        "Units": 0.3
                    },
                    {
                        "Time": "15:30",
                        "Bracket": "Shoulder",
                        "Units": 0.3
                    },
                    {
                        "Time": "16:00",
                        "Bracket": "Shoulder",
                        "Units": 0.4
                    },
                    {
                        "Time": "16:30",
                        "Bracket": "Shoulder",
                        "Units": 0.4
                    },
                    {
                        "Time": "17:00",
                        "Bracket": "Peak",
                        "Units": 1.0
                    },
                    {
                        "Time": "17:30",
                        "Bracket": "Peak",
                        "Units": 1.1
                    },
                    {
                        "Time": "18:00",
                        "Bracket": "Peak",
                        "Units": 1.4
                    },
                    {
                        "Time": "18:30",
                        "Bracket": "Peak",
                        "Units": 1.6
                    },
                    {
                        "Time": "19:00",
                        "Bracket": "Peak",
                        "Units": 1.4
                    },
                    {
                        "Time": "19:30",
                        "Bracket": "Peak",
                        "Units": 1.3
                    },
                    {
                        "Time": "20:00",
                        "Bracket": "Shoulder",
                        "Units": 1.0
                    },
                    {
                        "Time": "20:30",
                        "Bracket": "Shoulder",
                        "Units": 0.7
                    },
                    {
                        "Time": "21:00",
                        "Bracket": "Shoulder",
                        "Units": 0.6
                    },
                    {
                        "Time": "21:30",
                        "Bracket": "OffPeak",
                        "Units": 0.6
                    },
                    {
                        "Time": "22:00",
                        "Bracket": "OffPeak",
                        "Units": 0.5
                    },
                    {
                        "Time": "22:30",
                        "Bracket": "OffPeak",
                        "Units": 0.4
                    },
                    {
                        "Time": "23:00",
                        "Bracket": "OffPeak",
                        "Units": 0.3
                    },
                    {
                        "Time": "23:30",
                        "Bracket": "OffPeak",
                        "Units": 0.3
                    }
                ],
                "Brackets": [
                    {
                        "Bracket": "Shoulder",
                        "Start": "2017-10-23T00:00:00Z",
                        "StartSec": -36000,
                        "End": "2017-10-23T06:00:00Z",
                        "EndSec": -14400
                    },
                    {
                        "Bracket": "Peak",
                        "Start": "2017-10-23T06:00:00Z",
                        "StartSec": -14400,
                        "End": "2017-10-23T12:00:00Z",
                        "EndSec": 7200
                    },
                    {
                        "Bracket": "Shoulder",
                        "Start": "2017-10-23T12:00:00Z",
                        "StartSec": 7200,
                        "End": "2017-10-23T18:00:00Z",
                        "EndSec": 28800
                    },
                    {
                        "Bracket": "OffPeak",
                        "Start": "2017-10-23T18:00:00Z",
                        "StartSec": 28800,
                        "End": "2017-10-24T00:00:00Z",
                        "EndSec": 50400
                    }
                ],
                "UsageSummary": {
                    "CurrentMonth": [
                        {
                            "Bracket": "OffPeak",
                            "Units": 123.4
                        },
                        {
                            "Bracket": "Shoulder",
                            "Units": 234.5
                        },
                        {
                            "Bracket": "Peak",
                            "Units": 345.6
                        }
                    ],
                    "PriorMonth": [
                        {
                            "Bracket": "OffPeak",
                            "Units": 122.2
                        },
                        {
                            "Bracket": "Shoulder",
                            "Units": 240.7
                        },
                        {
                            "Bracket": "Peak",
                            "Units": 150
                        }
                    ]
                }
            }
        }
    }
    else if (productId == '0001445259UN10B' || productId == '1001291607UN160') {
        powerProduct = { "MonthStartDate": "2017-12-01", "Today": "2017-12-04", "MonthlyUsage": [] }
    }
    return powerProduct;
}

function mockGasProductDetails(productId) {
    let gasProduct: any;
    if (productId == '123456') {
        gasProduct = {
            "Today": "2017-11-15",
            "LastMonthsUsage": 47.98,
            "MonthlyUsage": [
                { "Date": "2015-11-01", "Units": 159 },
                { "Date": "2015-12-01", "Units": 159 },
                { "Date": "2016-01-01", "Units": 159 },
                { "Date": "2017-10-01", "Units": 159 },
            ],
        };
    }
    else if (productId == '0001011076NG3FF' || productId == '1001291497QT475') {
        gasProduct = { "Today": "2017-12-04", "MonthlyUsage": [] }
    }
    return gasProduct;
}
