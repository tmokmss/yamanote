class CreateSchedules < ActiveRecord::Migration[5.2]
  def change
    create_table :schedules do |t|
      t.string :station
      t.integer :time
      t.integer :direction
      t.integer :trainId
      t.integer :dayType

      t.timestamps
    end
  end
end
