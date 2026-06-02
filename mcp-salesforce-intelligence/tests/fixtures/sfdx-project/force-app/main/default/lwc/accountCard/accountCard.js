import { LightningElement, api, wire } from 'lwc';
import getAccounts from '@salesforce/apex/AccountService.getAccounts';
import ACCOUNT_NAME from '@salesforce/label/c.AccountName';

export default class AccountCard extends LightningElement {
    @api recordId;
    @api accountName;
    
    @wire(getAccounts, { ids: '$recordId' })
    accounts;
    
    handleClick() {
        this.dispatchEvent(new CustomEvent('select', { detail: this.recordId }));
    }
}
