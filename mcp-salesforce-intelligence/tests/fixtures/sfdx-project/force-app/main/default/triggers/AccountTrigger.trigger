trigger AccountTrigger on Account (before insert, before update, after insert) {
    AccountService service = new AccountService();
    if (Trigger.isBefore) {
        // validation logic
    }
}
