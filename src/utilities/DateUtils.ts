export default class DateUtils {

    static getTimeAroundSecond(myDate: Date): Date {
        if (myDate !== undefined) {
            const newDate = new Date(myDate.getTime());
            const newUpdatedDate = new Date(newDate.setMilliseconds(0));
            return newUpdatedDate;
        }
        return undefined;
    }
}