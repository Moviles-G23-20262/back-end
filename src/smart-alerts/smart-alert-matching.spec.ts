import { alertMatches, type MatchableAlert, type MatchableMaterial } from './smart-alert-matching';

describe('alertMatches', () => {
  const alert: MatchableAlert = { keyword: '', courseCode: null, category: null, maxPrice: '50000.00', minCondition: null };
  const material: MatchableMaterial = {
    title: 'Cálculo de Stewart, 8va edición',
    courseCode: 'MATE1203',
    category: 'BOOKS',
    price: '45000.00',
    condition: 'LIKE_NEW',
  };

  it('an empty alert under the price limit matches everything', () => {
    expect(alertMatches(alert, material)).toBe(true);
  });

  it('a listing over the price limit never matches', () => {
    expect(alertMatches({ ...alert, maxPrice: '44999.99' }, material)).toBe(false);
  });

  it('the keyword is looked up in the title and the course code, ignoring case', () => {
    expect(alertMatches({ ...alert, keyword: 'stewart' }, material)).toBe(true);
    expect(alertMatches({ ...alert, keyword: 'mate1203' }, material)).toBe(true);
    expect(alertMatches({ ...alert, keyword: 'física' }, material)).toBe(false);
  });

  it('category and course must be the same when the alert sets them', () => {
    expect(alertMatches({ ...alert, category: 'CALCULATORS' }, material)).toBe(false);
    expect(alertMatches({ ...alert, courseCode: ' mate1203 ' }, material)).toBe(true);
    expect(alertMatches({ ...alert, courseCode: 'FISI1018' }, material)).toBe(false);
  });

  it('the minimum condition accepts that condition or better', () => {
    expect(alertMatches({ ...alert, minCondition: 'GOOD' }, material)).toBe(true);
    expect(alertMatches({ ...alert, minCondition: 'LIKE_NEW' }, material)).toBe(true);
    expect(alertMatches({ ...alert, minCondition: 'NEW' }, material)).toBe(false);
    expect(alertMatches({ ...alert, minCondition: 'FAIR' }, { ...material, condition: null })).toBe(false);
  });
});
