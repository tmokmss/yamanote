require('./app/jobs/concerns/batch_processor')
require('./app/jobs/scrape_ekitan_job')

class ScrapingController < ApplicationController
  def show
    ScrapeEkitanJob.perform_now

    respond_to do |format|
      format.html { render :show }
    end

  end
end
