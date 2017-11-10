const pg = require('pg');
const knex = require("knex")({
    client: 'pg',
    connection: {
        user: "frondeadmin",
        password: "Fronde00",
        host: "salesforce-skyvia-test-instance.czn5quzr5koz.ap-southeast-2.rds.amazonaws.com",
        port: '5432',
        database: "salesforce_skyvia_test_db"
    },
    pool: {
        min: 0,
        max: 5
    },
    requestTimeout: 10000,
    acquireConnectionTimeout: 10000
});
//-------------------------------------------------------
//getProductSummary("0d35be3e-c71f-4e63-9212-dc00c2bd2aba");
getProductSummary("203dfd3b-6ea5-41c8-8299-7f8b0fe6b478");
// console.log(formatMobileNum("+64212626624"));
// console.log(formatMobileNum("0212626624"));
// console.log(formatMobileNum("212626624"));

//--------------------Functions------------------------------
function getProductSummary(cogid) {
    
    knex.from('ICP__c')
        .innerJoin('Contact', 'AccountId', 'ICP__c.Account__c')
        .innerJoin('ContactRegister', 'Contact.Id', 'ContactRegister.ContactId')
        .innerJoin('RecordType', 'RecordType.Id', 'ICP__c.RecordTypeId')
        .where({ 'ContactRegister.CognitoIdentity': cogid })
        .select('ICP__c.Name', 'ICP__c.PDCT__c', 'ICP__c.Address_Formula__c','RecordType.Name as RecordType')
        .then(d => {
            //console.log(d);
            let summaryReturn = [];
            d.forEach(function (element) {
                
                let singlePremise = { Address: null, Products: {} };
                let data = { Id: null }
                let singleProduct = { ProductType: null, Data: data };
                let products = [];
                //let singleTod = {};
                data = {
                    Id: element.Name
                }
                singleProduct.Data = data;
                products.push(singleProduct);
                singlePremise = {
                    "Address": element.Address_Formula__c,
                    "Products": products
                };
                switch (element.RecordType) {
                    case 'Natural Gas':
                        singleProduct.ProductType = 'GAS';
                        break;
                    case 'Electricity':
                        singleProduct.ProductType = 'POWER';
                        //TODO:get the following data from Axos API,hardcoded them at the moment
                        //TODO:get isTOD data and add isTOD condition
                        let singleTod = [
                            { "Bracket": "shoulder", "Start": "2017-10-23T21:00:00Z", "StartSec": 0, "End": "2017-10-24T04:59:59Z", "EndSec": 21600 },
                            { "Bracket": "peak", "Start": "2017-10-24T04:00:00Z", "StartSec": 21600, "End": "2017-10-24T06:59:59Z", "EndSec": 32400 },
                            { "Bracket": "shoulder", "Start": "2017-10-24T07:00:00Z", "StartSec": 32400, "End": "2017-10-24T09:59:59Z", "EndSec": 43200 },
                            { "Bracket": "off_peak", "Start": "2017-10-24T10:00:00Z", "StartSec": 43200, "End": "2017-10-24T17:59:59Z", "EndSec": 68400 }
                        ]
                        //TODO:get the following data from DB,hardcoded them at the moment
                        data.IsTod = element.IsTod;
                        data.CurrentUsage = "50.68";
                        data.UsageAsAt = "2017-12-16T11:00:00Z";
                        data.EstimatedUsage = "120.34";
                        data.Tod = singleTod;
                        break;
                    default:

                }

                summaryReturn.push(singlePremise)
                
            }, this);
            let response = {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(summaryReturn)
            };
            console.log(JSON.stringify(summaryReturn));
            //console.log("Response:" + JSON.stringify(response));
            //callback(null, response);
        }).catch(e => {
            console.log(e);
            let serverErrorResponse = responseHandler.serverError(e);
            //callback(null, serverErrorResponse);
        }).finally(() => {
            //console.log(singlePremise);
            //knex.close();

        })
    knex.destroy();
}




//----------------------------------------------------

function formatMobileNum(mobileNum) {
    var formatedNum;
    mobileFormat1 = /^([2]\d)(.*)$/;
    mobileFormat2 = /^([0][2]\d)(.*)$/;

    if (mobileFormat1.test(mobileNum)) {
        formatedNum = '+64' + mobileNum;
    }
    else if (mobileFormat2.test(mobileNum)) {
        formatedNum = mobileNum.replace(/^0(.*)$/, (_, a) => a);
        formatedNum = '+64' + formatedNum;
    }
    else {
        formatedNum = mobileNum
    }

    return formatedNum;
}
