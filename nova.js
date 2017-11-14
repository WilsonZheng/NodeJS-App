
//--DB connection setup
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
//---------get productSummary API test cases:
//getProductSummary("0d35be3e-c71f-4e63-9212-dc00c2bd2aba");
//getProductSummary("203dfd3b-6ea5-41c8-8299-7f8b0fe6b478");

//---------formatMobileNum test cases:
// console.log(formatMobileNum("+64212626624"));
// console.log(formatMobileNum("0212626624"));
// console.log(formatMobileNum("212626624"));

//--WhiteListCheck:test cases  
WhiteListCheck('ap-southeast-2:63ca9bb1-f34a-4d2e-a24f-dab84e4c9271');
WhiteListCheck('ap-southeast-2:e9ebe742-499a-4acf-ba19-a27a5889b805');
WhiteListCheck('ap-southeast-2:b7cc31e1-be5d-4979-a21f-7f81a08f649b');
//--------------------Functions------------------------------
//----get product summary api: return http response
function getProductSummary(cogid) {

    knex.from('ICP__c')
        .innerJoin('Contact', 'AccountId', 'ICP__c.Account__c')
        .innerJoin('ContactRegister', 'Contact.Id', 'ContactRegister.ContactId')
        .innerJoin('RecordType', 'RecordType.Id', 'ICP__c.RecordTypeId')
        .where({ 'ContactRegister.CognitoIdentity': cogid })
        .select('ICP__c.Name', 'ICP__c.PDCT__c', 'ICP__c.Address_Formula__c', 'RecordType.Name as RecordType')
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




//--------------Method to format mobile number--------------------------------------

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
//--------------Method to do UAT white list privelige check: return true or false--------------------------------------
function WhiteListCheck(cogid) {

    knex.from('UatWhiteList')
        .innerJoin('Contact', 'Contact.AccountId', 'UatWhiteList.AccountId')
        .innerJoin('ContactRegister', 'Contact.Id', 'ContactRegister.ContactId')
        .where({ 'ContactRegister.CognitoIdentity': cogid })
        .select('UatWhiteList.AccountId', 'UatWhiteList.IsWhiteList')
        .then(d => {
            //console.log(d);
            if (d.length == 1) {
                if (d[0].IsWhiteList) {
                    //console.log("True");
                    return true;
                } else {
                    //console.log("False");
                    return false;
                }
            } else {
                //console.log("False");
                return false;
            }
        }).catch(e => {
            console.log(e);
        }).finally(() => {
            knex.close();
        })

}
