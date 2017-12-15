import { street1 } from "aws-sdk/clients/importexport";
import { float } from "aws-sdk/clients/lightsail";
import { DateTime } from "aws-sdk/clients/ec2";
import { int } from "aws-sdk/clients/datapipeline";


export class SinglePremise{
    Address: string;
    Products: SingleProduct[];
}

export class SingleProduct {
    ProductType: string;
    Data: SingleProductData;
}

export class SingleProductData {
    Id: string;
    IsTod?: boolean;
    CurrentUsage?: float;
    UsageAsAt?: DateTime;
    EstimatedUsage?: float;
    Tod?: SingleTodBracket[]
}

export class SingleTodBracket {
    Bracket: string;
    Start: DateTime;
    StartSec: int;
    End: DateTime;
    EndSec: int;
}

export class ProductDetail {
    Today: Date;
    CurrentUsage?: float;
    UsageAsAt?: DateTime;
    LastMonthsUsage?: float;
    EstimatedUsage?:float;
    MonthlyUsage?: SingleUsage[];
    DailyUsage?: SingleUsage[];
    Tod?: TodDetail;
}
export class SingleUsage{
    Date:Date;
    Units: float;
}
export class TodDetail{
    Savings:float;
    SavingsToDate: float;
    Brackets: SingleTodBracket[];
    UsageSummary:UsageSummaryDetail;
    HalfHourlyAverage:SingleHalfHourlyAverageDetail[];
}
export class UsageSummaryDetail{
    CurrentMonth:MonthDetail;
    PriorMonth:MonthDetail;

}
export class MonthDetail{
    Brackets:SingleBracketDetail[];
}
export class SingleBracketDetail{
    Bracket:string;
    Units:float;
}
export class SingleHalfHourlyAverageDetail{
    Time:DateTime;
    Bracket:String;
    Units:float;
}