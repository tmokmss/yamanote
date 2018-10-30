# frozen_string_literal: true

require 'nokogiri'
require 'open-uri'

require_relative './station_processor'
require_relative './schedule_types'

class BatchProcessor
  def initialize(url_base, direction, first_page_id, dayType)
    @url_base = url_base
    @first_page_id = first_page_id
    @dayType = dayType
    @direction = direction
    @pros = []
  end

  def merge
    entries = []
    @pros.each do |pro|
      sub = pro.to_array(@direction, @dayType)
      sub.each do |entry|
        entries.append(entry)
      end
    end
    entries
  end

  def make_url(pageId, nodirection = false)
    suffix = case @dayType
             when DayType::Saturday then
               '_sat.htm'
             when DayType::Holiday then
               '_holi.htm'
             else
               '.htm'
             end

    direction = case @direction
                when DirectionType::Up
                  'up'
                when DirectionType::Down
                  'down'
                end

    if nodirection
      direction = ""
    end

    "#{@url_base}#{direction}#{pageId}#{suffix}"
  end

  def process
    urls = get_url_list

    urls.each do |url|
      pro = StationProcessor.new(url)
      pro.process
      @pros.append(pro)
      sleep(1)
    end
  end

  private

  def get_url_list
    doc = Nokogiri::HTML.parse(open(make_url(@first_page_id)), nil, 'Shift_JIS')

    pageElms = doc.xpath('//select/option')
    urls = []

    pageElms.each do |pageElm|
      pageId = pageElm.xpath('@value').text
      urls.append(make_url(pageId, true))
    end

    pros = []
    # urls = [urls[0]] # for debug
    urls
  end
end
