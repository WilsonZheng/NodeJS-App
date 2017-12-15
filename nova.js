
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
getProductSummary("ap-southeast-2:e9ebe742-499a-4acf-ba19-a27a5889b805");

//---------formatMobileNum test cases:
// console.log(formatMobileNum("+64212626624"));
// console.log(formatMobileNum("0212626624"));
// console.log(formatMobileNum("212626624"));

//--WhiteListCheck:test cases  
//WhiteListCheck('ap-southeast-2:63ca9bb1-f34a-4d2e-a24f-dab84e4c9271');
//validateRegistration('ap-southeast-2:e9ebe742-499a-4acf-ba19-a27a5889b805');
//WhiteListCheck1('ap-southeast-2:e9ebe742-499a-4acf-ba19-a27a5889b805');
//WhiteListCheck('ap-southeast-2:b7cc31e1-be5d-4979-a21f-7f81a08f649b');
//--------------------Functions------------------------------
//----get product summary api: return http response
const request = require('request-promise');

const get = url =>
request.get({
  url: 'https://axosbilling-staging.novaconnect.co.nz' + url,
  headers: {
    Accept: 'application/json',
    Authorization: 'Token NT3q5fDONIfgZgSnXESjrA, name=novastaging1',
    'Content-Type': 'application/json'
  }
})


function getProductSummary(cogid) {
    knex.from('Account')
        .innerJoin('Contact', 'AccountId', 'Account.Id')
        .innerJoin('ContactRegister', 'Contact.Id', 'ContactRegister.ContactId')
        .where({ 'ContactRegister.CognitoIdentity': cogid })
        .select('Account.Party_Code__c as saleForeceAccNum')
        .then(d => {
            let sFAccNum = d.saleForceAccNum;
            return{
                latestTodInvoice: CustomerNumber =>
                    get('/api/v1.0/accounts?filter[account_number]=' + sFAccNum)
                    .then(data => console.log(data.data[0].id))
                    //.then(accountId => get('/api/v1.0/accounts/' + accountId + '/invoiceables'))
            }

        })

    // knex.from('ICP__c')
    //     .innerJoin('Contact', 'AccountId', 'ICP__c.Account__c')
    //     .innerJoin('ContactRegister', 'Contact.Id', 'ContactRegister.ContactId')
    //     .innerJoin('RecordType', 'RecordType.Id', 'ICP__c.RecordTypeId')
    //     .innerJoin('Account','Account.Id','ICP__c.Account__c')
    //     .where({ 'ContactRegister.CognitoIdentity': cogid })
    //     .select('ICP__c.Name', 'ICP__c.PDCT__c', 'ICP__c.Address_Formula__c', 'RecordType.Name as RecordType','Account.Party_Code__c as saleForeceAccNum')
    //     .then(d => {
    //         console.log(d);
    //         let summaryReturn = [];
    //         d.forEach(function (element) {

    //             let singlePremise = { Address: null, Products: {} };
    //             let data = { Id: null }
    //             let singleProduct = { ProductType: null, Data: data };
    //             let products = [];
    //             //let singleTod = {};
    //             data = {
    //                 Id: element.Name
    //             }
    //             singleProduct.Data = data;
    //             products.push(singleProduct);
    //             singlePremise = {
    //                 "Address": element.Address_Formula__c,
    //                 "Products": products
    //             };
    //             switch (element.RecordType) {
    //                 case 'Natural Gas':
    //                     singleProduct.ProductType = 'GAS';
    //                     break;
    //                 case 'Electricity':
    //                     singleProduct.ProductType = 'POWER';
    //                     //TODO:get the following data from Axos API,hardcoded them at the moment
    //                     //TODO:get isTOD data and add isTOD condition
    //                     let singleTod = [
    //                         { "Bracket": "shoulder", "Start": "2017-10-23T21:00:00Z", "StartSec": 0, "End": "2017-10-24T04:59:59Z", "EndSec": 21600 },
    //                         { "Bracket": "peak", "Start": "2017-10-24T04:00:00Z", "StartSec": 21600, "End": "2017-10-24T06:59:59Z", "EndSec": 32400 },
    //                         { "Bracket": "shoulder", "Start": "2017-10-24T07:00:00Z", "StartSec": 32400, "End": "2017-10-24T09:59:59Z", "EndSec": 43200 },
    //                         { "Bracket": "off_peak", "Start": "2017-10-24T10:00:00Z", "StartSec": 43200, "End": "2017-10-24T17:59:59Z", "EndSec": 68400 }
    //                     ]
    //                     //TODO:get the following data from DB,hardcoded them at the moment
    //                     data.IsTod = element.IsTod;
    //                     data.CurrentUsage = "50.68";
    //                     data.UsageAsAt = "2017-12-16T11:00:00Z";
    //                     data.EstimatedUsage = "120.34";
    //                     data.Tod = singleTod;
    //                     break;
    //                 default:

    //             }

    //             summaryReturn.push(singlePremise)

    //         }, this);
    //         let response = {
    //             statusCode: 200,
    //             headers: { "Content-Type": "application/json" },
    //             body: JSON.stringify(summaryReturn)
    //         };
    //         //console.log(JSON.stringify(summaryReturn));
    //         //console.log("Response:" + JSON.stringify(response));
    //         //callback(null, response);
    //     }).catch(e => {
    //         console.log(e);
    //         let serverErrorResponse = responseHandler.serverError(e);
    //         //callback(null, serverErrorResponse);
    //     }).finally(() => {
    //         //console.log(singlePremise);
    //         //knex.close();

    //     })
    // knex.destroy();
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
//--------------Method to do white list privelige check: return true or false--------------------------------------
function WhiteListCheck1(cogid) {

    knex.from('ApiConfig').select('WhiteListEnabled').then(d => {
        if (d[0].WhiteListEnabled) {
            knex.from('WhiteListAccounts')
                .innerJoin('Contact', 'Contact.AccountId', 'WhiteListAccounts.AccountId')
                .innerJoin('ContactRegister', 'Contact.Id', 'ContactRegister.ContactId')
                .where({ 'ContactRegister.CognitoIdentity': cogid })
                .select('WhiteListAccounts.AccountId')
                .then(d => {
                    console.log(d);
                    if (d.length == 1) {

                        console.log("True");
                        return true;

                    } else {
                        console.log("False");
                        return false;
                    }
                })
        } else {
            return false;
        }
    }).catch(e => {
        console.log(e);
    }).finally(() => {
        //knex.close();
        knex.destroy();
    })

}


// knex.from('UatWhiteList')
// .innerJoin('Contact', 'Contact.AccountId', 'UatWhiteList.AccountId')
// .innerJoin('ContactRegister', 'Contact.Id', 'ContactRegister.ContactId')
// .where({ 'ContactRegister.CognitoIdentity': cogid })
// .select('UatWhiteList.AccountId', 'UatWhiteList.IsWhiteList')
// .then(d => {
//     //console.log(d);
//     if (d.length == 1) {
//         if (d[0].IsWhiteList) {
//             //console.log("True");
//             return true;
//         } else {
//             //console.log("False");
//             return false;
//         }
//     } else {
//         //console.log("False");
//         return false;
//     }
// }).catch(e => {
//     console.log(e);
// }).finally(() => {
//     knex.close();
// })




/*
* Sample code to validate user.  
*/
function validateTest(event, context, callback) {

    //let cognitoID = event.requestContext.identity.cognitoIdentityId;
    let cognitoID = event && event.requestContext && event.requestContext.identity && event.requestContext.identity.cognitoIdentityId ? event.requestContext.identity.cognitoIdentityId : null;


    let success = validateAuth(event, context);
    console.log("AAA");
    console.log(context);
    console.log("AAA");
    if (success)
        callback(null, responseHandler.success("Success"));
    else
        callback(null, responseHandler.error(401, "User Not Found", "UserNotFound"));
};

function validateAuth(cognitoIdentity) {
    //context.callbackWaitsForEmptyEventLoop = false;
    return knex.select()
        .table('ContactRegister')
        .where({ 'CognitoIdentity': cognitoIdentity })
}

function validate(event, context) {
    let success = validateAuth(event, context);
    if (success) {
        context.succeed("User is Valid");
    } else {
        context.fail("User is Invalid");
    }
};

function validateRegistration(cognitoIdentity) {
    return new Promise(function (resolve, reject) {
        //TEMP: Whitelist users during the UAT period
        console.log('1');
        WhiteListCheck(cognitoIdentity).then(d => {
            console.log('whitelist return is: ' + d);
            if (d) {
                // validateAuth(cognitoIdentity).then(authResult => {
                //     console.log('authResult is ' + authResult);
                //     if (authResult.length) {
                //         resolve(true);
                //     }
                //     else {
                //         resolve(false);
                //     }
                // })
                //     .catch(e => {
                //         console.log('Error occured during the auth validation ' + e)
                //         reject(false);
                //     })
            }
        });
    })
    console.log('2');
}

function WhiteListCheck(cogid) {
    console.log('whitelisting start...');
    return new Promise(function (resolve, reject) {
        readApiConfig().then(d => {
            console.log("result of readAPIConfig:" + JSON.stringify(d[0]));
            if (d[0].WhiteListEnabled) {
                readWhitelistAccountTable(cogid)
                    .then(d => {
                        console.log('white list account found: ' + JSON.stringify(d));
                        if (d.length == 1) {
                            console.log("True from WhiteListCheck");
                            resolve(true);
                        }
                        else {
                            console.log("False from WhiteListCheck");
                            resolve(false);
                        }
                    })
                    .catch(e => {
                        console.log('error reading Whitelist Accounts table ' + e);
                    });
            } else {
                resolve(false);
            }
        }).catch(e => {
            console.log(e);
            reject(e);
        }).finally(() => {
            //knex.close();
            knex.destroy();
        })
    })
}



function readApiConfig() {
    console.log('reading apiconfig...');
    return knex.from('ApiConfig').select('WhiteListEnabled');
}

function readWhitelistAccountTable(cogid) {
    console.log('reading whitelist accounts for ' + cogid);
    return knex.from('WhiteListAccounts')
        .innerJoin('Contact', 'Contact.AccountId', 'WhiteListAccounts.AccountId')
        .innerJoin('ContactRegister', 'Contact.Id', 'ContactRegister.ContactId')
        .where({ 'ContactRegister.CognitoIdentity': cogid })
        .select('WhiteListAccounts.AccountId')

}

//-----------------------------------Get product summary with AXOS call

module.exports.productSummary = function (event, context, callback) {

    context.callbackWaitsForEmptyEventLoop = false;
    let cognitoIdentityId = event && event.requestContext && event.requestContext.identity && event.requestContext.identity.cognitoIdentityId ? event.requestContext.identity.cognitoIdentityId : null;
    if (!cognitoIdentityId) {
        console.log('Cognito Identity Id is null');
        //TODO: enabled this just for local dev purposes!
        //cognitoIdentityId = 'ap-southeast-2:b7cc31e1-be5d-4979-a21f-7f81a08f649b';
        cognitoIdentityId = 'ap-southeast-2:e9ebe742-499a-4acf-ba19-a27a5889b805';

    }
    console.log('hard-coded cog id is: ' + cognitoIdentityId);

    //TODO: Validate whether user is registered (TEMP SOLUTION)
    authHandler.validateRegistration(cognitoIdentityId).then(regReturn => {
        console.log(regReturn);
        let errorResponse;
        if (regReturn === false) {
            errorResponse = {
                statusCode: 401,
                body: JSON.stringify({ "errorType": "NotAuthorizedException", "message": "User not registerd" })
            }
            callback(null, errorResponse);
        }
        else {
            //call authHandler whitelist method
            authHandler.validateWhitelistUser(cognitoIdentityId).then(validatedResult => {
                console.log("Result from whitelist in GetProduct:" + validatedResult);
                if (validatedResult === false) {
                    errorResponse = {
                        statusCode: 401,
                        body: JSON.stringify({ "errorType": "NotAuthorizedException", "message": "User is not whitelisted" })
                    }
                    callback(null, errorResponse);
                }
                else {
                    let singlePremise;
                    let data;
                    let singleProduct;
                    let products = [];
                    let summaryReturn = [];
                    knex.from('Account')
                        .innerJoin('Contact', 'AccountId', 'Account.Id')
                        .innerJoin('ContactRegister', 'Contact.Id', 'ContactRegister.ContactId')
                        .where({ 'ContactRegister.CognitoIdentity': cognitoIdentityId })
                        .select('Account.Party_Code__c as saleForeceAccNum')
                        .then(d => {

                            let sFAccNum = d.saleForceAccNum;

                            console.log("saleForceAccNum:" + sFAccNum + ", hard code it as 233904 for now.");
                            sFAccNum = 233904;

                            const get = url =>
                                request.get({
                                    url: 'https://axosbilling-staging.novaconnect.co.nz' + url,
                                    headers: {
                                        Accept: 'application/json',
                                        Authorization: 'Token NT3q5fDONIfgZgSnXESjrA, name=novastaging1',
                                        'Content-Type': 'application/json'
                                    }
                                })
                                    .then(JSON.parse);
                            
                            get('/api/v1.0/accounts?filter[account_number]=' + sFAccNum)
                                .then(res => {
                                    console.log(JSON.stringify(data))
                                    return res.data[0].id;
                                })
                                .then(accountId => get('/api/v1.0/accounts/' + accountId + '/invoiceables'))
                                .then(res => res.data[0].id)
                                .then(invoiceableId => {
                                    console.log("InvoiceableId:" + invoiceableId);
                                    return get('/api/v1.0/invoiceables/' + invoiceableId + '/contracted_icps')
                                })
                                .then(res =>{
                                    console.log(JSON.stringify(res));
                                    ({ singlePremise, data, singleProduct, products } = getProductDetails(cognitoIdentityId, singlePremise, data, singleProduct, products, summaryReturn, callback));
                                })
                        })


                    
                }
            })

        }
    })

}

function getProductDetails(cognitoIdentityId, singlePremise, data, singleProduct, products, summaryReturn, callback) {
    knex.from('ICP__c')
        .innerJoin('Contact', 'AccountId', 'ICP__c.Account__c')
        .innerJoin('ContactRegister', 'Contact.Id', 'ContactRegister.ContactId')
        .where({ 'ContactRegister.CognitoIdentity': cognitoIdentityId })
        .select('ICP__c.Name', 'ICP__c.PDCT__c', 'ICP__c.Address_Formula__c')
        .then(d => {
            d.forEach(function (element) {
                //console.log(element);
                singlePremise = { Address: null, Products: {} };
                data = { Id: null };
                singleProduct = { ProductType: null, Data: data };
                products = [];
                //let singleTod = {};
                data = {
                    Id: element.Name
                };
                singleProduct = {
                    ProductType: element.PDCT__c,
                    Data: data
                };
                products.push(singleProduct);
                singlePremise = {
                    "Address": element.Address_Formula__c,
                    "Products": products
                };
                if (element.PDCT__c == 'POWER' && (element.IsTod = true)) {
                    //TODO:get the following data from Axos API,currently hardcoded
                    let singleTod = [
                        { "Bracket": "shoulder", "Start": "2017-10-23T21:00:00Z", "StartSec": 0, "End": "2017-10-24T04:59:59Z", "EndSec": 21600 },
                        { "Bracket": "peak", "Start": "2017-10-24T04:00:00Z", "StartSec": 21600, "End": "2017-10-24T06:59:59Z", "EndSec": 32400 },
                        { "Bracket": "shoulder", "Start": "2017-10-24T07:00:00Z", "StartSec": 32400, "End": "2017-10-24T09:59:59Z", "EndSec": 43200 },
                        { "Bracket": "off_peak", "Start": "2017-10-24T10:00:00Z", "StartSec": 43200, "End": "2017-10-24T17:59:59Z", "EndSec": 68400 }
                    ];
                    //TODO:get the following data from DB,currently hardcoded 
                    data.IsTod = element.IsTod;
                    data.CurrentUsage = "50.68";
                    data.UsageAsAt = "2017-12-16T11:00:00Z";
                    data.EstimatedUsage = "120.34";
                    data.Tod = singleTod;
                }
                summaryReturn.push(singlePremise);
            }, this);
            let response = responseHandler.success(summaryReturn);
            callback(null, response);
        }).catch(e => {
            console.log(e);
            let serverErrorResponse = responseHandler.serverError(e);
            callback(null, serverErrorResponse);
        }).finally(() => {
            console.log("Closing - ICPLookup!");
            //knex.close();
        });
    return { singlePremise, data, singleProduct, products };
}
