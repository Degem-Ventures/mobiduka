import 'customer_repository.dart';

class CustomerService {
  CustomerService({CustomerRepository? repository}) : _repository = repository ?? CustomerRepository();

  final CustomerRepository _repository;

  Future<void> ensureCustomerSchema() => _repository.ensureCustomerSchema();

  Future<String> onboardOfflineCustomer({
    required String businessId,
    required String name,
    String? phone,
    double initialCreditLimit = 0,
  }) {
    return _repository.createOfflineCustomer(
      businessId: businessId,
      name: name,
      phone: phone,
      initialCreditLimit: initialCreditLimit,
    );
  }

  Future<List<Map<String, dynamic>>> fetchAllCachedCustomers({String businessId = 'demo-business'}) {
    return _repository.searchLocalCustomers('', businessId: businessId);
  }

  Future<List<Map<String, dynamic>>> searchCachedCustomers(String query, {String businessId = 'demo-business'}) {
    return _repository.searchLocalCustomers(query, businessId: businessId);
  }
}
