public with sharing class AccountService implements IAccountService {
    private Logger logger;
    
    public List<Account> getAccounts(Set<Id> ids) {
        return [SELECT Id, Name FROM Account WHERE Id IN :ids];
    }
    
    public Account createAccount(AccountDTO dto) {
        Account acc = new Account(Name = dto.name);
        insert acc;
        return acc;
    }
    
    public void deleteAccount(Id id) {
        Account acc = [SELECT Id FROM Account WHERE Id = :id];
        delete acc;
    }
}
