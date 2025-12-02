const cds = require('@sap/cds');

module.exports = cds.service.impl(async function() {
  const { Books } = this.entities;

  this.on('READ', 'Books', async (req) => {
    // if (!req.user.is('Admin') && !req.user.is('Viewer')) {
    //   return req.reject(403, 'Not authorized');
    // }
    return SELECT.from('Books');
  });

  // Po každém READ na Books upravíme data před odesláním
  this.after('READ', Books, (books, req) => {
    // může přijít jeden objekt nebo pole
    const arr = Array.isArray(books) ? books : [books];

    for (const book of arr) {
      if (book.title == null) continue;

      if (book.price > 100) {
        book.discount = 15;
      } else if (book.price > 50) {
        book.discount = 5;
      } else {
        book.discount = 0;
      }
    }
  });
});