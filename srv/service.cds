// srv/service.cds
using my.bookshop as my from '../db/schema';

service CatalogService {
  // @restrict: [
  //   { grant: 'READ', to: ['Viewer'] },
  //   { grant: '*', to: ['Admin'] }
  // ]
  entity Books as projection on my.Books;
}