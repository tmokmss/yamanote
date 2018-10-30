require 'nokogiri'
require 'open-uri'
require_relative './schedule_entry'

class StationProcessor
  def initialize(url)
    @url = url
  end

  def process()
    doc = get_doc()
    @deparrs = process_deparrs(doc)
    @stations = process_stations(doc)
    @time_tables = process_timetable(doc)
    @train_ids = process_train_id(doc)
    fix_stations(@stations, @deparrs)
  end

  def to_array(direction, dayType)
    entries = []
    @time_tables.each_with_index do |table, col|
      table.each_with_index do |time, row|
        next if time.empty?
        depArr = @deparrs[row] == "発" ? DepArrType::Departure : DepArrType::Arrival
        entry = ScheduleEntry.new(time_to_int(time), @stations[row], direction, @train_ids[col], dayType, depArr)
        entries.append(entry)
      end
    end
    return entries
  end

  private

  def time_to_int(time)
    hh = time[0..1].to_i
    mm = time[3..4].to_i
    if hh >= 0 and hh < 2
      hh += 24
    end
    return hh * 100 + mm
  end

  def get_doc()
    doc = Nokogiri::HTML.parse(open(@url), nil, 'Shift_JIS')
    return doc
  end

  def process_deparrs(doc)
    deparrs = []
    deparrElms = doc.xpath('//*[@class="lowBg06"]')
    deparrElms.each do |stationElm|
      as = stationElm.xpath('span/span')
      next if as == nil
      as.each do |station|
        text = station.text.strip
        next if text.empty?
        next if text != '発' and text != '着'
        deparrs.append(text)
      end
    end
    return deparrs
  end

  def process_stations(doc)
    stations = []
    stationElms = doc.xpath('//*[@class="lowBg06"]')
    stationElms.each do |stationElm|
      as = stationElm.xpath('span/span/a')
      next if as == nil
      as.each do |station|
        text = station.text.strip
        next if text.empty?
        next if text == '発'
        stations.append(text)
      end
    end
    return stations
  end

  def fix_stations(stations, deparrs)
    deparrs.each_with_index do |deparr, i|
      next if stations[i] == stations[0]
      if deparr == "着"
        stations.insert(i, stations[i])
      end
    end
  end

  def process_timetable(doc)
    time_tables = []
    timeElms = doc.xpath('//*[@class="lowBgFFF" or @class="lowBg12"]')
    timeElms.each do |timeElm|
      times = timeElm.xpath('span')
      next if times == nil
      time_table = []
      regex = /^\d+:\d+\z/
      test1 = times[-1].text.match(regex)
      test2 = times[0].text.match(regex)
      next if test1 == nil && test2 == nil
      times.each do |time|
        t = time.text.match(regex)
        time_text = t != nil ? t[0] : ''
        time_table.append(time_text)
      end
      time_tables.append(time_table)
    end
    return time_tables
  end

  def process_train_id(doc)
    train_ids = []
    trs = doc.xpath('//tr')
    trs.each do |tr| 
      tds = tr.xpath('td/span/span')
      next if tds.nil? or tds.length == 0
      next if tds[0].text != '列車番号'
      tds.slice(1..-1).each do |td|
        train_ids.append(td.text)
      end
    end

    return train_ids
  end
end