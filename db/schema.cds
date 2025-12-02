namespace my.bookshop;

entity Books {
  key ID    : UUID;
  title     : String;
  price     : Integer;
  currency  : String;
  discount  : Integer;
}